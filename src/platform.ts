import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AirCondionerAccessory } from './platformAccessory';
import { AuxCloudAPI, AuxCloudDevice } from './auxCloudApi';

export class AuxCloudPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly activeAccessories: Map<string, AirCondionerAccessory> = new Map();

  private auxCloudAPI!: AuxCloudAPI;
  private discoveryInterval?: NodeJS.Timeout;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Initializing AUX Cloud Platform...');

    if (!config.email || !config.password) {
      this.log.error('Email and password are required for AUX Cloud connection');
      return;
    }

    const region = (config.region as string) || 'eu';
    this.auxCloudAPI = new AuxCloudAPI(region);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();

      const discoveryInterval = (config.discoveryInterval as number) || 0;
      if (discoveryInterval > 0) {
        this.log.info(`Setting up periodic device discovery every ${discoveryInterval} minutes`);
        this.discoveryInterval = setInterval(() => {
          this.discoverDevices();
        }, discoveryInterval * 60 * 1000);
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices() {
    this.log.info('Starting device discovery...');

    try {
      const email = this.config.email as string;
      const password = this.config.password as string;
      
      this.log.info('Logging in to AUX Cloud...');
      const loginSuccess = await this.auxCloudAPI.login(email, password);
      
      if (!loginSuccess) {
        this.log.error('Failed to login to AUX Cloud. Check your credentials.');
        return;
      }

      this.log.info('Login successful! Getting families...');
      const families = await this.auxCloudAPI.getFamilies();
      this.log.info(`Found ${families.length} families`);

      const hiddenDevices = (this.config.hiddenDevices as string[]) || [];
      const allDevices: AuxCloudDevice[] = [];

      for (const family of families) {
        this.log.debug(`Checking family: ${family.name} (${family.familyid})`);
        const devices = await this.auxCloudAPI.getDevices(family.familyid);
        allDevices.push(...devices);
      }

      this.log.info(`Found ${allDevices.length} total devices`);

      const visibleDevices = allDevices.filter(device => {
        const isHidden = hiddenDevices.includes(device.endpointId) || 
                        hiddenDevices.includes(device.friendlyName);
        if (isHidden) {
          this.log.info(`Hiding device: ${device.friendlyName} (${device.endpointId})`);
        }
        return !isHidden;
      });

      this.log.info(`Exposing ${visibleDevices.length} devices to HomeKit`);

      for (const device of visibleDevices) {
        await this.addOrUpdateDevice(device);
      }

      this.removeUnusedAccessories(visibleDevices);

    } catch (error) {
      this.log.error('Error during device discovery:', error);
    }
  }

  async addOrUpdateDevice(device: AuxCloudDevice) {
    const uuid = this.api.hap.uuid.generate(device.endpointId);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.info('Updating existing accessory:', device.friendlyName);
      existingAccessory.context.device = device;
      existingAccessory.displayName = device.friendlyName;
      
      const existingService = this.activeAccessories.get(uuid);
      if (existingService) {
        existingService.updateDevice(device);
      } else {
        const airConditionerAccessory = new AirCondionerAccessory(this, existingAccessory, device);
        this.activeAccessories.set(uuid, airConditionerAccessory);
      }

      this.api.updatePlatformAccessories([existingAccessory]);
    } else {
      this.log.info('Adding new accessory:', device.friendlyName);
      const accessory = new this.api.platformAccessory(device.friendlyName, uuid);
      accessory.context.device = device;

      const airConditionerAccessory = new AirCondionerAccessory(this, accessory, device);
      this.activeAccessories.set(uuid, airConditionerAccessory);

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }

  removeUnusedAccessories(currentDevices: AuxCloudDevice[]) {
    const currentDeviceIds = new Set(currentDevices.map(d => d.endpointId));
    const accessoriesToRemove: PlatformAccessory[] = [];

    for (const accessory of this.accessories) {
      const deviceId = accessory.context.device?.endpointId;
      if (deviceId && !currentDeviceIds.has(deviceId)) {
        this.log.info('Removing accessory:', accessory.displayName);
        accessoriesToRemove.push(accessory);
        this.activeAccessories.delete(accessory.UUID);
      }
    }

    if (accessoriesToRemove.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove);
      
      for (const accessory of accessoriesToRemove) {
        const index = this.accessories.indexOf(accessory);
        if (index > -1) {
          this.accessories.splice(index, 1);
        }
      }
    }
  }

  async getAuthenticatedAPI(): Promise<AuxCloudAPI> {
    if (!this.auxCloudAPI.isLoggedIn()) {
      const email = this.config.email as string;
      const password = this.config.password as string;
      await this.auxCloudAPI.login(email, password);
    }
    return this.auxCloudAPI;
  }

  shutdown() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
  }
}
