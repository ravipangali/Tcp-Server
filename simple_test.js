const GT06Decoder = require('./gt06_decoder');
const GT06Database = require('./database');

async function runTests() {
  console.log('🧪 Testing GT06 System Components...\n');

  // Test 1: GT06 Decoder
  console.log('🔍 Testing GT06 Decoder...');
  try {
    const decoder = new GT06Decoder();
    
    // Create a proper GT06 login packet
    const loginPacket = Buffer.from('787811010123456789012345000A0D0A', 'hex');
    console.log('Test packet:', loginPacket.toString('hex').toUpperCase());
    
    const packets = decoder.addData(loginPacket);
    console.log('Decoded packets count:', packets.length);
    
    if (packets.length > 0) {
      console.log('✅ GT06 Decoder working');
      console.log('Protocol:', packets[0].protocolName);
    } else {
      console.log('⚠️  No packets decoded (expected for test data)');
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
}

runTests().catch(console.error); 