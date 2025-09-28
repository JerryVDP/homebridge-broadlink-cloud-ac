#!/usr/bin/env node

/**
 * Test script for debugging AUX Cloud device parameter issues
 * Usage: node test-device-params.js <email> <password> [region]
 */

const { AuxCloudAPI } = require('./dist/auxCloudApi');

async function testDeviceParams() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node test-device-params.js <email> <password> [region]');
    console.log('Regions: eu (default), usa, cn');
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];
  const region = args[2] || 'eu';

  console.log(`🔌 Connecting to AUX Cloud (${region})...`);
  
  const api = new AuxCloudAPI(region);
  
  try {
    // Step 1: Login
    console.log('\n📋 Step 1: Logging in...');
    const loginSuccess = await api.login(email, password);
    
    if (!loginSuccess) {
      console.error('❌ Failed to login to AUX Cloud. Check your credentials.');
      process.exit(1);
    }
    console.log('✅ Login successful!');
    
    // Step 2: Get families
    console.log('\n📋 Step 2: Getting families...');
    const families = await api.getFamilies();
    console.log(`✅ Found ${families.length} families`);
    
    // Step 3: Get devices from all families
    console.log('\n📋 Step 3: Getting devices...');
    const allDevices = [];
    
    for (const family of families) {
      console.log(`  📁 Checking family: ${family.name} (ID: ${family.familyid})`);
      const devices = await api.getDevices(family.familyid);
      console.log(`  🔍 Found ${devices.length} devices in this family`);
      
      for (const device of devices) {
        console.log(`    📱 Device: ${device.friendlyName}`);
        console.log(`       - Endpoint ID: ${device.endpointId}`);
        console.log(`       - Product ID: ${device.productId}`);
        console.log(`       - MAC: ${device.mac}`);
        console.log(`       - Has Cookie: ${!!device.cookie}`);
        console.log(`       - Has DevSession: ${!!device.devSession}`);
        console.log(`       - Cookie Length: ${device.cookie?.length || 'N/A'}`);
        
        // Try to decode cookie if it exists
        if (device.cookie) {
          try {
            const decodedCookie = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
            console.log(`       - Cookie Structure:`, Object.keys(decodedCookie));
            console.log(`       - Cookie Details:`, decodedCookie);
          } catch (e) {
            console.log(`       - Cookie decode error: ${e.message}`);
          }
        }
        
        console.log(`       - All Properties: ${Object.keys(device).join(', ')}`);
        console.log('');
      }
      
      allDevices.push(...devices);
    }

    console.log(`\n📋 Step 4: Testing device parameter retrieval...`);
    
    if (allDevices.length === 0) {
      console.log('❌ No devices found to test');
      return;
    }

    // Test the first device
    const testDevice = allDevices[0];
    console.log(`🧪 Testing device: ${testDevice.friendlyName} (${testDevice.endpointId})`);
    
    api.setDevice(testDevice);
    
    try {
      console.log('\n🔧 Attempting to get device parameters...');
      const params = await api.getDeviceParams(testDevice, ['pwr', 'temp', 'ac_mode']);
      console.log('✅ Device parameters retrieved successfully:');
      console.log(JSON.stringify(params, null, 2));
      
      console.log('\n🔧 Attempting to get current state...');
      const state = await api.getCurrentState();
      console.log('✅ Current state retrieved successfully:');
      console.log(JSON.stringify(state, null, 2));
      
    } catch (error) {
      console.log('❌ Error getting device parameters:');
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      
      // Try with minimal parameters
      console.log('\n🔧 Trying with minimal parameters...');
      try {
        const minimalParams = await api.getDeviceParams(testDevice, ['pwr']);
        console.log('✅ Minimal parameters retrieved:');
        console.log(JSON.stringify(minimalParams, null, 2));
      } catch (minError) {
        console.log('❌ Even minimal parameters failed:', minError.message);
      }
    }
    
    // Test all devices briefly
    console.log('\n📋 Step 5: Quick test of all devices...');
    for (let i = 0; i < Math.min(allDevices.length, 3); i++) {
      const device = allDevices[i];
      console.log(`\n🧪 Testing device ${i + 1}: ${device.friendlyName}`);
      
      api.setDevice(device);
      
      try {
        const quickTest = await api.getDeviceParams(device, ['pwr']);
        console.log(`✅ Device ${i + 1} - SUCCESS: power = ${quickTest.pwr}`);
      } catch (error) {
        console.log(`❌ Device ${i + 1} - FAILED: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testDeviceParams().catch(console.error);