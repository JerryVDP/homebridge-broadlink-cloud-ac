#!/usr/bin/env node

// Test script for improved device parameter retrieval
// Usage: node test-improved-device-params.js

const { AuxCloudAPI } = require('./dist/auxCloudApi');

async function testDeviceParams() {
  console.log('🧪 Testing improved device parameter retrieval...\n');

  // Initialize API
  const api = new AuxCloudAPI('usa'); // Using USA region

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const email = process.env.AUX_EMAIL;
    const password = process.env.AUX_PASSWORD;
    
    if (!email || !password) {
      console.error('❌ Please set AUX_EMAIL and AUX_PASSWORD environment variables');
      console.log('Example: AUX_EMAIL=your@email.com AUX_PASSWORD=yourpassword node test-improved-device-params.js');
      process.exit(1);
    }

    await api.login(email, password);
    console.log('✅ Login successful');

    // Step 2: Get families
    console.log('\nStep 2: Getting families...');
    const families = await api.getFamilies();
    console.log(`✅ Found ${families.length} families`);
    
    if (families.length === 0) {
      console.log('No families found. Make sure you have devices registered in the AUX Cloud app.');
      return;
    }

    // Step 3: Get devices from all families
    console.log('\nStep 3: Getting devices from all families...');
    const allDevices = [];
    
    for (const family of families) {
      console.log(`Getting devices from family: ${family.name} (${family.familyid})`);
      const devices = await api.getDevices(family.familyid);
      console.log(`Found ${devices.length} devices in family ${family.name}`);
      allDevices.push(...devices);
    }
    
    console.log(`✅ Found ${allDevices.length} total device(s)`);
    
    if (allDevices.length === 0) {
      console.log('No devices found in any family. Make sure you have AC units registered in the AUX Cloud app.');
      return;
    }

    // Step 4: Test improved device parameter retrieval
    for (let i = 0; i < allDevices.length; i++) {
      const device = allDevices[i];
      console.log(`\n--- Testing Device ${i + 1}: ${device.friendlyName} ---`);
      console.log(`Device ID: ${device.endpointId}`);
      console.log(`Product ID: ${device.productId}`);
      console.log(`MAC: ${device.mac}`);
      console.log(`Has Cookie: ${!!device.cookie}`);
      console.log(`Has DevSession: ${!!device.devSession}`);

      try {
        // Test with no specific parameters (should get all)
        console.log('\n🔍 Testing basic parameter retrieval...');
        const basicParams = await api.getDeviceParams(device, []);
        console.log('✅ Basic parameters retrieved:', Object.keys(basicParams).length > 0 ? 'SUCCESS' : 'NO DATA');
        console.log('📊 Basic parameters:', basicParams);

        // Test with specific parameters
        console.log('\n🔍 Testing specific parameter retrieval (power status)...');
        const powerParams = await api.getDeviceParams(device, ['pwr']);
        console.log('✅ Power parameter retrieved:', powerParams);

        // Test with special 'mode' parameter to get ambient temperature
        console.log('\n🔍 Testing special "mode" parameter for ambient temperature...');
        const modeParams = await api.getDeviceParams(device, ['mode']);
        console.log('✅ Mode parameter retrieved:', modeParams);

        // Test with multiple specific parameters (with delay to avoid server busy)
        console.log('\n🔍 Testing multiple specific parameters (with delay)...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        const multiParams = await api.getDeviceParams(device, ['pwr', 'ac_mode', 'temp']);
        console.log('✅ Multiple parameters retrieved:', multiParams);

      } catch (error) {
        console.error(`❌ Device parameter test failed for ${device.friendlyName}:`, error.message);
        
        // Debug information
        console.log('\n🔧 Debug information:');
        if (device.cookie) {
          try {
            const cookieData = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
            console.log('Cookie data keys:', Object.keys(cookieData));
            console.log('Cookie has terminalid:', !!cookieData.terminalid);
            console.log('Cookie has aeskey:', !!cookieData.aeskey);
          } catch (cookieError) {
            console.error('Failed to parse cookie:', cookieError.message);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n🏁 Test completed');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
testDeviceParams().catch(console.error);