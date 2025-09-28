import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import { AuxCloudPlatform } from './platform';
import { ACMode, DeviceState, AuxCloudDevice } from './auxCloudApi';

export class AirCondionerAccessory {
  private readonly platform: AuxCloudPlatform;
  private readonly accessory: PlatformAccessory;
  private device: AuxCloudDevice;
  private currentState: DeviceState | null = null;
  private updateInterval?: NodeJS.Timeout;
  private readonly service: Service;
  private readonly informationService: Service;

  constructor(platform: AuxCloudPlatform, accessory: PlatformAccessory, device: AuxCloudDevice) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = device;

    this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation) ||
      this.accessory.addService(this.platform.Service.AccessoryInformation);

    this.informationService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'AUX')
      .setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, device.endpointId);

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler);

    this.service.setCharacteristic(this.platform.Characteristic.Name, device.friendlyName);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.handleActiveGet.bind(this))
      .on('set', this.handleActiveSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .on('get', this.handleCurrentStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .on('get', this.handleTargetStateGet.bind(this))
      .on('set', this.handleTargetStateSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.handleCurrentTemperatureGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({ minValue: 16, maxValue: 32, minStep: 0.5 })
      .on('get', this.handleCoolingThresholdTemperatureGet.bind(this))
      .on('set', this.handleCoolingThresholdTemperatureSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({ minValue: 16, maxValue: 32, minStep: 0.5 })
      .on('get', this.handleHeatingThresholdTemperatureGet.bind(this))
      .on('set', this.handleHeatingThresholdTemperatureSet.bind(this));

    this.initializeDevice();
  }

  async initializeDevice(): Promise<void> {
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      
      this.platform.log.info(`Initialized device: ${this.device.friendlyName} (${this.device.endpointId})`);
      
      await this.updateState();
      this.startPolling();
    } catch (error) {
      this.platform.log.error(`Failed to initialize device ${this.device.friendlyName}:`, error);
    }
  }

  updateDevice(device: AuxCloudDevice): void {
    this.device = device;
    this.accessory.context.device = device;
    this.service.setCharacteristic(this.platform.Characteristic.Name, device.friendlyName);
    this.informationService.setCharacteristic(this.platform.Characteristic.SerialNumber, device.endpointId);
  }

  startPolling(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateState();
      } catch (error) {
        this.platform.log.error(`Error updating state for ${this.device.friendlyName}:`, error);
      }
    }, 10000);
  }

  async updateState(): Promise<void> {
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      this.currentState = await auxCloudAPI.getCurrentState();
      this.updateCharacteristics();
    } catch (error) {
      this.platform.log.error(`Failed to update state for ${this.device.friendlyName}:`, error);
    }
  }

  private updateCharacteristics(): void {
    if (!this.currentState) return;

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .updateValue(this.currentState.power ? 1 : 0);
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .updateValue(this.currentState.currentTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .updateValue(this.currentState.targetTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .updateValue(this.currentState.targetTemperature);
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .updateValue(this.getCurrentHeaterCoolerState());
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .updateValue(this.getTargetHeaterCoolerState());
  }

  handleActiveGet(callback: CharacteristicGetCallback) {
    const value = this.currentState?.power ? 1 : 0;
    callback(null, value);
  }

  async handleActiveSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const isOn = value as boolean;
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      await auxCloudAPI.setPower(isOn);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  handleCurrentStateGet(callback: CharacteristicGetCallback) {
    callback(null, this.getCurrentHeaterCoolerState());
  }

  handleTargetStateGet(callback: CharacteristicGetCallback) {
    callback(null, this.getTargetHeaterCoolerState());
  }

  async handleTargetStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const targetState = value as number;
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      
      let mode: ACMode;
      switch (targetState) {
        case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
          mode = ACMode.COOLING;
          break;
        case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
          mode = ACMode.HEATING;
          break;
        default:
          mode = ACMode.AUTO;
          break;
      }
      
      await auxCloudAPI.setMode(mode);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  handleCurrentTemperatureGet(callback: CharacteristicGetCallback) {
    const value = this.currentState?.currentTemperature || 20;
    callback(null, value);
  }

  handleCoolingThresholdTemperatureGet(callback: CharacteristicGetCallback) {
    const value = this.currentState?.targetTemperature || 24;
    callback(null, value);
  }

  async handleCoolingThresholdTemperatureSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const temperature = value as number;
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      await auxCloudAPI.setTemperature(temperature);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  handleHeatingThresholdTemperatureGet(callback: CharacteristicGetCallback) {
    const value = this.currentState?.targetTemperature || 24;
    callback(null, value);
  }

  async handleHeatingThresholdTemperatureSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const temperature = value as number;
    try {
      const auxCloudAPI = await this.platform.getAuthenticatedAPI();
      auxCloudAPI.setDevice(this.device);
      await auxCloudAPI.setTemperature(temperature);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private getCurrentHeaterCoolerState(): number {
    if (!this.currentState?.power) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }

    switch (this.currentState.mode) {
      case ACMode.COOLING:
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
      case ACMode.HEATING:
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
      default:
        if (this.currentState.currentTemperature > this.currentState.targetTemperature) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
        } else if (this.currentState.currentTemperature < this.currentState.targetTemperature) {
          return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        } else {
          return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }
    }
  }

  private getTargetHeaterCoolerState(): number {
    switch (this.currentState?.mode) {
      case ACMode.COOLING:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
      case ACMode.HEATING:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
    }
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
