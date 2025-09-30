import axios, { AxiosInstance } from 'axios';
import * as CryptoJS from 'crypto-js';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// Constants from the HomeAssistant implementation
const TIMESTAMP_TOKEN_ENCRYPT_KEY = 'kdixkdqp54545^#*';
const PASSWORD_ENCRYPT_KEY = '4969fj#k23#';
const BODY_ENCRYPT_KEY = 'xgx3d*fe3478$ukx';
const LICENSE = 'PAFbJJ3WbvDxH5vvWezXN5BujETtH/iuTtIIW5CE/SeHN7oNKqnEajgljTcL0fBQQWM0XAAAAAAnBhJyhMi7zIQMsUcwR/PEwGA3uB5HLOnr+xRrci+FwHMkUtK7v4yo0ZHa+jPvb6djelPP893k7SagmffZmOkLSOsbNs8CAqsu8HuIDs2mDQAAAAA=';
const LICENSE_ID = '3c015b249dd66ef0f11f9bef59ecd737';
const COMPANY_ID = '48eb1b36cf0202ab2ef07b880ecda60d';
const SPOOF_APP_VERSION = '2.2.10.456537160';
const SPOOF_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B Build/SP1A.210812.016)';
const SPOOF_SYSTEM = 'android';
const SPOOF_APP_PLATFORM = 'android';

// AES IV from HomeAssistant implementation - exact bytes from Python
const AES_INITIAL_VECTOR_BYTES = Buffer.from([
  234, 170, 170, 58, 187, 88, 98, 162, 25, 24, 181, 119, 29, 22, 21, 170
]);

// API Server URLs
const API_SERVERS = {
  eu: 'https://app-service-deu-f0e9ebbb.smarthomecs.de',
  usa: 'https://app-service-usa-fd7cc04c.smarthomecs.com',
  cn: 'https://app-service-chn-31a93883.ibroadlink.com',
};

// AC Constants
export enum ACMode {
  COOLING = 0,
  HEATING = 1,
  DRY = 2,
  FAN = 3,
  AUTO = 4,
}

export enum ACFanSpeed {
  AUTO = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  TURBO = 4,
  MUTE = 5,
}

export interface DeviceState {
  power: boolean;
  mode: ACMode;
  targetTemperature: number;
  currentTemperature: number;
  fanSpeed: ACFanSpeed;
  verticalSwing: boolean;
  horizontalSwing: boolean;
  display: boolean;
  health: boolean;
  clean: boolean;
  mildew: boolean;
  sleep: boolean;
  ecoMode: boolean;
}

export interface AuxCloudDevice {
  endpointId: string;
  friendlyName: string;
  productId: string;
  mac: string;
  devSession: string;
  cookie: string;
  params: Record<string, any>;
}

export class AuxCloudAPI extends EventEmitter {
  private axios: AxiosInstance;
  private loginsession?: string;
  private userid?: string;
  private email?: string;
  private password?: string;
  private region: string;
  private families: Record<string, any> = {};
  private selectedDevice?: AuxCloudDevice;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 1 second between requests
  // Batching state for outbound parameter updates to reduce duplicate beeps / rapid sequential commands
  private paramQueue: Record<string, any> = {};
  private paramQueueDeviceId?: string;
  private paramQueueTimer?: NodeJS.Timeout;
  private paramQueueDelay = 1000; // ms delay window to merge (power + mode + others)
  private paramQueueResolvers: Array<{ resolve: () => void; reject: (e: any) => void }> = [];
  private paramFlushInProgress = false;

  constructor(region: string = 'eu') {
    super();
    this.region = region;
    
    const baseURL = API_SERVERS[region as keyof typeof API_SERVERS] || API_SERVERS.eu;
    
    this.axios = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-java-serialized-object',
        'licenseId': LICENSE_ID,
        'lid': LICENSE_ID,
        'language': 'en',
        'appVersion': SPOOF_APP_VERSION,
        'User-Agent': SPOOF_USER_AGENT,
        'system': SPOOF_SYSTEM,
        'appPlatform': SPOOF_APP_PLATFORM,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
    });
  }

  private encryptAESWithNodeCrypto(iv: Buffer, key: Buffer, data: string): Buffer {
    // Exactly match Python implementation: encrypt_aes_cbc_zero_padding
    const dataBuffer = Buffer.from(data, 'utf8');
    
    // Calculate padding: padded_data += b"\x00" * (AES.block_size - len(data) % AES.block_size)
    const blockSize = 16;
    const paddingLength = blockSize - (dataBuffer.length % blockSize);
    const paddedData = Buffer.concat([
      dataBuffer,
      Buffer.alloc(paddingLength, 0)
    ]);

    // Use Node.js crypto to exactly match Python's AES.new(key, AES.MODE_CBC, iv)
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(false); // We handle padding manually
    
    let encrypted = cipher.update(paddedData);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return encrypted;
  }

  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'loginsession': this.loginsession || '',
      'userid': this.userid || '',
      ...additionalHeaders,
    };
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      this.email = email;
      this.password = password;

      const currentTime = Math.floor(Date.now() / 1000);
      const shaPassword = CryptoJS.SHA1(`${password}${PASSWORD_ENCRYPT_KEY}`).toString();
      
      const payload = {
        email,
        password: shaPassword,
        companyid: COMPANY_ID,
        lid: LICENSE_ID,
      };

      const jsonPayload = JSON.stringify(payload);
      const token = CryptoJS.MD5(`${jsonPayload}${BODY_ENCRYPT_KEY}`).toString();
      // Use Node.js crypto to exactly match Python implementation
      const timestampTokenString = `${currentTime}${TIMESTAMP_TOKEN_ENCRYPT_KEY}`;
      const timestampTokenMd5 = crypto.createHash('md5').update(timestampTokenString).digest();
      
      // Use the exact IV bytes
      const encryptedBody = this.encryptAESWithNodeCrypto(AES_INITIAL_VECTOR_BYTES, timestampTokenMd5, jsonPayload);

      const response = await this.axios.post('/account/login', encryptedBody, {
        headers: {
          ...this.getHeaders({
            timestamp: currentTime.toString(),
            token,
          }),
          'Content-Type': 'application/x-java-serialized-object',
        },
        responseType: 'json',
        // Ensure axios doesn't transform the binary data
        transformRequest: [(data) => data],
      });

      // Check for successful response - handle both status and error fields
      if (response.data?.status === 0 || response.data?.error === 0) {
        this.loginsession = response.data.loginsession;
        this.userid = response.data.userid;
        console.log('Login successful!');
        return true;
      }

      const errorCode = response.data?.error ?? response.data?.status;
      throw new Error(`Login failed with code ${errorCode}: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return false;
    }
  }

  async getFamilies(): Promise<any[]> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    try {
      const response = await this.axios.post('/appsync/group/member/getfamilylist', '', {
        headers: this.getHeaders(),
      });

      if (response.data?.status === 0) {
        const families = response.data.data.familyList || [];
        this.families = {};
        
        for (const family of families) {
          this.families[family.familyid] = {
            id: family.familyid,
            name: family.name,
            devices: [],
          };
        }
        
        return families;
      }

      throw new Error(`Failed to get families: ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.error('Get families error:', error);
      throw error;
    }
  }

  async getDevices(familyId: string): Promise<AuxCloudDevice[]> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    try {
      const response = await this.axios.post('/appsync/group/dev/query?action=select', '{"pids":[]}', {
        headers: this.getHeaders({ familyid: familyId }),
      });

      if (response.data?.status === 0) {
        const devices = response.data.data?.endpoints || [];
        const validDevices = devices.filter((device: any) => device.productId && device.mac);
        
        // Log device structure for debugging
        if (validDevices.length > 0) {
          for (const device of validDevices) {
            console.log('Found device:', {
              endpointId: device.endpointId,
              friendlyName: device.friendlyName,
            });
          }
        }
        
        return validDevices;
      }

      throw new Error(`Failed to get devices: ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.error('Get devices error:', error);
      throw error;
    }
  }

  async getDeviceParams(device: AuxCloudDevice, params: string[] = []): Promise<Record<string, any>> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    // Apply rate limiting to avoid server busy errors
    await this.rateLimit();

    try {
      // Check if device has required properties
      if (!device.cookie || !device.devSession) {
        console.error('Device missing required properties:', {
          endpointId: device.endpointId,
          hasCookie: !!device.cookie,
          hasDevSession: !!device.devSession
        });
        throw new Error('Device missing required cookie or devSession');
      }

      const cookie = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
      
      // Use the HA extension cookie structure for better compatibility
      const mappedCookie = Buffer.from(JSON.stringify({
        device: {
          id: cookie.terminalid,
          key: cookie.aeskey,
          devSession: device.devSession,
          aeskey: cookie.aeskey,
          did: device.endpointId,
          pid: device.productId,
          mac: device.mac,
        },
      }, null, 0)).toString('base64');

      const data = {
        directive: {
          header: this.getDirectiveHeader('DNA.KeyValueControl', 'KeyValueControl', device.endpointId),
          endpoint: {
            devicePairedInfo: {
              did: device.endpointId,
              pid: device.productId,
              mac: device.mac,
              devicetypeflag: 0, // Default value as seen in HA extension
              cookie: mappedCookie,
            },
            endpointId: device.endpointId,
            cookie: {},
            devSession: device.devSession,
          },
          payload: {
            act: 'get',
            params: params.length > 0 ? params : [],
            vals: params.length === 1 ? [[{ val: 0, idx: 1 }]] : [],
          },
        },
      };

      // Add device ID to payload for compatibility
      (data.directive.payload as any).did = device.endpointId;

      const response = await this.axios.post('/device/control/v2/sdkcontrol', data, {
        headers: this.getHeaders(),
        params: { license: LICENSE },
      });

      // Handle error responses
      if (response.data?.event?.header?.name === 'ErrorResponse') {
        const errorPayload = response.data.event.payload;
        console.error('Device control error:', {
          type: errorPayload.type,
          message: errorPayload.message,
          status: errorPayload.status,
          deviceId: device.endpointId
        });
        throw new Error(`Device control error: ${errorPayload.type} (${errorPayload.status}): ${errorPayload.message}`);
      }

      if (response.data?.event?.payload?.data) {
        const responseData = JSON.parse(response.data.event.payload.data);
        const result: Record<string, any> = {};
        
        if (responseData.params && responseData.vals) {
          for (let i = 0; i < responseData.params.length; i++) {
            result[responseData.params[i]] = responseData.vals[i]?.[0]?.val || 0;
          }
        }
        
        return result;
      }

      throw new Error(`Failed to get device params: ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.error('Get device params error:', error);
      throw error;
    }
  }

  async setDeviceParams(device: AuxCloudDevice, params: Record<string, any>, options?: { immediate?: boolean }): Promise<void> {
    // Batch by default; allow immediate flush with options.immediate
    return new Promise<void>((resolve, reject) => {
      try {
        // If queue holds different device, flush first
        if (this.paramQueueDeviceId && this.paramQueueDeviceId !== device.endpointId) {
          this.flushParamQueue().catch(err => console.error('[AuxCloudAPI] Error flushing previous device queue:', err));
        }

        this.paramQueueDeviceId = device.endpointId;
        for (const [k, v] of Object.entries(params)) {
          this.paramQueue[k] = v; // merge
        }
        this.paramQueueResolvers.push({ resolve, reject });

        // Turning off (pwr:0) should flush immediately; else small delay to combine with mode etc.
        const immediatePowerOff = Object.keys(params).includes('pwr') && params.pwr === 0;
        const delay = options?.immediate || immediatePowerOff ? 0 : this.paramQueueDelay;

        if (this.paramQueueTimer) {
          clearTimeout(this.paramQueueTimer);
        }
        this.paramQueueTimer = setTimeout(() => {
          this.flushParamQueue().catch(err => {
            const pending = this.paramQueueResolvers.splice(0);
            pending.forEach(p => p.reject(err));
          });
        }, delay);
      } catch (e) {
        reject(e);
      }
    });
  }

  private async flushParamQueue(): Promise<void> {
    if (this.paramFlushInProgress) return;
    if (!this.paramQueueDeviceId || Object.keys(this.paramQueue).length === 0) return;

    const device = this.selectedDevice && this.selectedDevice.endpointId === this.paramQueueDeviceId
      ? this.selectedDevice
      : undefined;

    if (!device) {
      const pendingNoDevice = this.paramQueueResolvers.splice(0);
      pendingNoDevice.forEach(p => p.reject(new Error('No selected device for parameter queue')));
      this.paramQueue = {};
      this.paramQueueDeviceId = undefined;
      return;
    }

    const paramsToSend = { ...this.paramQueue };
    this.paramQueue = {};
    this.paramQueueDeviceId = undefined;
    const resolvers = this.paramQueueResolvers.splice(0);
    this.paramFlushInProgress = true;
    try {
      if (!this.isLoggedIn()) throw new Error('Not logged in');
      if (!device.cookie || !device.devSession) throw new Error('Device missing required cookie or devSession');

      await this.rateLimit();

      const cookie = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
      const mappedCookie = Buffer.from(JSON.stringify({
        device: {
          id: cookie.terminalid,
          key: cookie.aeskey,
          devSession: device.devSession,
          aeskey: cookie.aeskey,
          did: device.endpointId,
          pid: device.productId,
          mac: device.mac,
        },
      })).toString('base64');

      const paramKeys = Object.keys(paramsToSend);
      const paramVals = paramKeys.map((key, index) => [{ idx: index + 1, val: paramsToSend[key] }]);

      const data = {
        directive: {
          header: this.getDirectiveHeader('DNA.KeyValueControl', 'KeyValueControl', device.endpointId),
          endpoint: {
            devicePairedInfo: {
              did: device.endpointId,
              pid: device.productId,
              mac: device.mac,
              devicetypeflag: (device as any).devicetypeFlag || 0,
              cookie: mappedCookie,
            },
            endpointId: device.endpointId,
            cookie: {},
            devSession: device.devSession,
          },
          payload: {
            act: 'set',
            params: paramKeys,
            vals: paramVals,
          },
        },
      } as any;
      data.directive.payload.did = device.endpointId;

      console.debug('[AuxCloudAPI] batched setDeviceParams request', JSON.stringify(data.directive.payload));
      const response = await this.axios.post('/device/control/v2/sdkcontrol', data, {
        headers: this.getHeaders(),
        params: { license: LICENSE },
      });

      if (response.data?.event?.header?.name === 'ErrorResponse') {
        const errorPayload = response.data.event.payload;
        throw new Error(`Device control error: ${errorPayload.type} (${errorPayload.status}): ${errorPayload.message}`);
      }
      if (!response.data?.event?.payload?.data) {
        throw new Error(`Failed to set device params: ${JSON.stringify(response.data)}`);
      }
      console.debug('[AuxCloudAPI] batched setDeviceParams success');
      resolvers.forEach(r => r.resolve());
      this.emit('updateState');
    } catch (err) {
      console.error('[AuxCloudAPI] batched setDeviceParams error:', err);
      resolvers.forEach(r => r.reject(err));
    } finally {
      this.paramFlushInProgress = false;
    }
  }

  private getDirectiveHeader(namespace: string, name: string, messageIdPrefix: string): any {
    const timestamp = Date.now();
    return {
      namespace,
      name,
      interfaceVersion: '2',
      senderId: 'sdk',
      messageId: `${messageIdPrefix}-${timestamp}`,
    };
  }

  setDevice(device: AuxCloudDevice): void {
    this.selectedDevice = device;
  }

  getDevice(): AuxCloudDevice | undefined {
    return this.selectedDevice;
  }

  async getCurrentState(withTemp: boolean = true): Promise<DeviceState | null> {
    if (!this.selectedDevice) {
      return null;
    }

    try {
      // --- Fetch base params (mirrors HA calling get_device_params with empty list) ---
      const params = await this.getDeviceParams(this.selectedDevice, []);

      // HA logic: envtemp may be missing unless special param 'mode' is queried separately.
      let ambient = params.envtemp;
      if (withTemp && ambient === undefined) {
        try {
          const special = await this.getDeviceParams(this.selectedDevice, ['mode']);
          if (special.envtemp !== undefined) {
            ambient = special.envtemp;
          }
        } catch (e) {
          console.warn('[AuxCloudAPI] Could not fetch ambient temperature via special mode parameter:', e instanceof Error ? e.message : String(e));
        }
      }
      if (ambient === undefined) ambient = 240; // fallback 24.0°C

      // Power (AC uses pwr, heat pump might expose ac_pwr)
      const powerParam = (params.pwr !== undefined ? params.pwr : params.ac_pwr) ?? 0;

      // Mode (ac_mode). Preserve 0 (cooling) by explicit undefined check.
      const modeParam = params.ac_mode !== undefined ? params.ac_mode : ACMode.AUTO;

      // Target temperature (temp for AC, ac_temp for HP). Default to 240 (24.0°C)
      const tempParam = (params.temp !== undefined ? params.temp : params.ac_temp) ?? 240;

      // Fan speed (ac_mark) default AUTO if missing
      const fanParam = params.ac_mark !== undefined ? params.ac_mark : ACFanSpeed.AUTO;

      // Convert reported /10 temps
      let targetTemperature = tempParam / 10;
      let currentTemperature = ambient / 10;

      // Temperature unit handling (optional): if tempunit present and suggests Fahrenheit, convert.
      // Empirical: tempunit==1 usually Celsius. If ==0 and values look like Fahrenheit ( > 45 ), convert.
      const tempUnit = params.tempunit;
      if (tempUnit === 0) {
        if (targetTemperature > 45) {
          targetTemperature = (targetTemperature - 32) / 1.8;
        }
        if (currentTemperature > 45) {
          currentTemperature = (currentTemperature - 32) / 1.8;
        }
      }

      const state: DeviceState = {
        power: powerParam === 1 || powerParam === true,
        mode: modeParam,
        targetTemperature: Number(targetTemperature.toFixed(1)),
        currentTemperature: Number(currentTemperature.toFixed(1)),
        fanSpeed: fanParam,
        verticalSwing: params.ac_vdir === 1,
        horizontalSwing: params.ac_hdir === 1,
        display: params.scrdisp === 1,
        health: params.ac_health === 1,
        clean: params.ac_clean === 1,
        mildew: params.mldprf === 1,
        sleep: params.ac_slp === 1,
        ecoMode: params.ecomode === 1,
      };

      return state;
    } catch (error) {
      console.error('Get current state error:', error);
      return null;
    }
  }

  async setPower(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { pwr: on ? 1 : 0 });
  }

  async setMode(mode: ACMode): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ac_mode: mode });
  }

  async setTemperature(temperature: number): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    // Convert 24.0°C -> 240
    const temp = Math.round(temperature * 10);
    await this.setDeviceParams(this.selectedDevice, { temp });
  }

  async setFanSpeed(speed: ACFanSpeed): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ac_mark: speed });
  }

  async setSwing(vertical: boolean, horizontal: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, {
      ac_vdir: vertical ? 1 : 0,
      ac_hdir: horizontal ? 1 : 0,
    });
  }

  async setDisplay(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { scrdisp: on ? 1 : 0 });
  }

  async setHealth(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ac_health: on ? 1 : 0 });
  }

  async setClean(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ac_clean: on ? 1 : 0 });
  }

  async setMildew(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { mldprf: on ? 1 : 0 });
  }

  async setSleep(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ac_slp: on ? 1 : 0 });
  }

  async setEcoMode(on: boolean): Promise<void> {
    if (!this.selectedDevice) {
      throw new Error('No device selected');
    }
    
    await this.setDeviceParams(this.selectedDevice, { ecomode: on ? 1 : 0 });
  }

  isLoggedIn(): boolean {
    return !!(this.loginsession && this.userid);
  }

  private async rateLimit(): Promise<void> {
    return;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async relogin(): Promise<boolean> {
    if (this.email && this.password) {
      return await this.login(this.email, this.password);
    }
    return false;
  }
}