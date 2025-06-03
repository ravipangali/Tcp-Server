const GT06Decoder = require('./gt06_decoder');
const GT06Database = require('./database');

async function runTests() {
  console.log('🧪 Testing GT06 System Components...\n');

  // Test 1: GT06 Decoder
  console.log('🔍 Testing GT06 Decoder...');
  try {
    const decoder = new GT06Decoder();
    
    // Test 1a: 7878 login packet
    console.log('\n📡 Testing 7878 login packet...');
    const loginPacket = Buffer.from('78781101086701007000155880751F41000129470D0A', 'hex');
    console.log('7878 packet:', loginPacket.toString('hex').toUpperCase());
    
    const packets1 = decoder.addData(loginPacket);
    console.log('Decoded packets count:', packets1.length);
    
    if (packets1.length > 0) {
      console.log('✅ 7878 LOGIN packet decoded');
      console.log('- Protocol:', packets1[0].protocolName);
      console.log('- Terminal ID:', packets1[0].terminalId);
      console.log('- Serial:', packets1[0].serialNumber);
    } else {
      console.log('❌ 7878 LOGIN packet not decoded');
    }
    
    // Test 1b: 7979 information transmission packet
    console.log('\n📡 Testing 7979 information packet...');
    const infoPacket = Buffer.from('797900089400051900043BD90D0A', 'hex');
    console.log('7979 packet:', infoPacket.toString('hex').toUpperCase());
    
    const packets2 = decoder.addData(infoPacket);
    console.log('Decoded packets count:', packets2.length);
    
    if (packets2.length > 0) {
      console.log('✅ 7979 packet decoded');
      console.log('- Protocol:', packets2[0].protocolName);
      console.log('- Is Extended:', packets2[0].isExtended);
      console.log('- Serial:', packets2[0].serialNumber);
      console.log('- Data:', packets2[0].informationData || packets2[0].data);
    } else {
      console.log('❌ 7979 packet not decoded');
    }
    
    // Test 1c: Real GPS LBS packet (from your actual device)
    console.log('\n📍 Testing Real GPS LBS packet...');
    const realGpsPacket = Buffer.from('78782DA019060311270BC702F84FB00927D44007140001AD01000028AC000000000005030300080100001EDE00068C370D0A', 'hex');
    console.log('GPS packet:', realGpsPacket.toString('hex').toUpperCase());
    
    const packets3 = decoder.addData(realGpsPacket);
    console.log('Decoded packets count:', packets3.length);
    
    if (packets3.length > 0) {
      console.log('✅ GPS packet decoded');
      console.log('- Protocol:', packets3[0].protocolName);
      console.log('- Terminal ID:', packets3[0].terminalId);
      console.log('- Has GPS:', !!(packets3[0].latitude && packets3[0].longitude));
      console.log('- GPS Time:', packets3[0].gpsTime);
      console.log('- Satellites:', packets3[0].satellites);
      if (packets3[0].latitude && packets3[0].longitude) {
        console.log('- Location:', packets3[0].latitude.toFixed(6), packets3[0].longitude.toFixed(6));
      }
      if (packets3[0].mcc) {
        console.log('- LBS MCC/MNC:', packets3[0].mcc, '/', packets3[0].mnc);
        console.log('- LAC/Cell ID:', packets3[0].lac, '/', packets3[0].cellId);
      }
      // Print complete JSON for this packet
      console.log('\n🔍 Complete decoded packet data:');
      console.log(JSON.stringify(packets3[0], (key, value) => {
        // Convert dates to readable strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }, 2));
    } else {
      console.log('❌ GPS packet not decoded');
    }
    
    // Test 1d: Status info packet
    console.log('\n📊 Testing Status Info packet...');
    const statusPacket = Buffer.from('78780A1305060400020005A3230D0A', 'hex');
    console.log('Status packet:', statusPacket.toString('hex').toUpperCase());
    
    const packets4 = decoder.addData(statusPacket);
    console.log('Decoded packets count:', packets4.length);
    
    if (packets4.length > 0) {
      console.log('✅ Status packet decoded');
      console.log('- Protocol:', packets4[0].protocolName);
      console.log('- Terminal Info:', packets4[0].terminalInfo);
      console.log('- Voltage:', packets4[0].voltage);
      console.log('- GSM Signal Strength:', packets4[0].gsmSignalStrength);
    } else {
      console.log('❌ Status packet not decoded');
    }
    
  } catch (error) {
    console.error('❌ Decoder test failed:', error.message);
  }

  // Test 2: Database
  console.log('\n💾 Testing Database...');
  try {
    const db = new GT06Database('./test_gt06.db');
    await db.init();
    console.log('✅ Database initialized successfully');
    
    const sessions = await db.getActiveSessions();
    console.log('✅ Database queries working, sessions:', sessions.length);
    
    await db.close();
    console.log('✅ Database closed cleanly');
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }

  // Test 3: Dependencies
  console.log('\n📚 Testing Dependencies...');
  try {
    require('express');
    require('sqlite3');
    require('cors');
    require('helmet');
    require('moment');
    console.log('✅ All dependencies available');
  } catch (error) {
    console.error('❌ Missing dependency:', error.message);
  }

  console.log('\n🎉 Basic tests completed!');
  console.log('\n🚀 Ready to start the GT06 server:');
  console.log('   npm start');
  console.log('\n📋 The server will handle both:');
  console.log('   - 7878 standard GT06 packets');
  console.log('   - 7979 extended GT06 packets');
  console.log('   - GPS positioning data');
  console.log('   - Device status information');
  console.log('   - LBS (cell tower) data');
  console.log('   - Alarm and alert data');
}

runTests().catch(console.error); 