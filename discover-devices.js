#!/usr/bin/env node

/**
 * AUX Cloud Device Discovery Tool
 * 
 * This script helps you find your device ID for the homebridge plugin configuration.
 * Usage: node discover-devices.js <email> <password> [region]
 */

const { AuxCloudAPI } = require('./dist/auxCloudApi');

async function discoverDevices() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node discover-devices.js <email> <password> [region]');
    console.log('Regions: eu (default), usa, cn');
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];
  const region = args[2] || 'eu';

  console.log(`Connecting to AUX Cloud (${region})...`);
  
  const api = new AuxCloudAPI(region);
  
  try {
    const loginSuccess = await api.login(email, password);
    
    if (!loginSuccess) {
      console.error('Failed to login to AUX Cloud. Check your credentials.');
      process.exit(1);
    }
    
    console.log('Login successful!');
    console.log('Fetching families...');
    
    const families = await api.getFamilies();
    console.log(`Found ${families.length} families`);
    
    for (const family of families) {
      console.log(`\nFamily: ${family.name} (ID: ${family.familyid})`);
      
      const devices = await api.getDevices(family.familyid);
      console.log(`  Found ${devices.length} devices:`);
      
      for (const device of devices) {
        console.log(`    - Name: ${device.friendlyName}`);
        console.log(`      Endpoint ID: ${device.endpointId}`);
        console.log(`      Product ID: ${device.productId}`);
        console.log(`      MAC: ${device.mac}`);
        console.log('');
      }
    }
    
    console.log('\nTo use a device in your homebridge config, use either:');
    console.log('- The "Endpoint ID" as the deviceId');
    console.log('- The "Name" as the deviceId (friendly name)');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

discoverDevices();