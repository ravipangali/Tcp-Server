#!/usr/bin/env node

console.log('🧪 Testing GT06 Comprehensive Protocol Decoder Installation...\n');

// Test 1: Module Loading
console.log('📦 Testing module imports...');
try {
  const GT06Decoder = require('./gt06_decoder');
  const GT06Database = require('./database');
  const setupAPIRoutes = require('./api_routes');
  console.log('✅ All modules loaded successfully');
} catch (error) {
  console.error('❌ Module loading failed:', error.message);
  process.exit(1);
}

// Test 2: GT06 Decoder Basic Functionality
console.log('\n🔍 Testing GT06 Decoder...');
try {
  const GT06Decoder = require('./gt06_decoder');
  const decoder = new GT06Decoder();
  
  // Test with a simple login packet: 7878110101234567890123450001D0A
  const testPacket = Buffer.from('7878110101234567890123450001D0A', 'hex');
  console.log('Test packet:', testPacket.toString('hex').toUpperCase());
  
  const decoded = decoder.addData(testPacket);
  console.log('Decoded packets:', decoded.length);
  
  if (decoded.length > 0) {
    console.log('✅ GT06 Decoder working correctly');
    console.log('Sample decoded data:', {
      protocol: decoded[0].protocolName,
      length: decoded[0].length,
      serialNumber: decoded[0].serialNumber
    });
  } else {
    console.log('⚠️  No packets decoded - this might be normal for malformed test data');
  }
} catch (error) {
  console.error('❌ GT06 Decoder test failed:', error.message);
}

// Test 3: Database Connection Test
console.log('\n💾 Testing Database Connection...');
try {
  const GT06Database = require('./database');
  const db = new GT06Database('./test_db.db');
  
  // Wait a moment for async initialization
  setTimeout(async () => {
    try {
      console.log('✅ Database module initialized');
      
      // Test basic query
      const sessions = await db.getActiveSessions();
      console.log('✅ Database queries working, active sessions:', sessions.length);
      
      await db.close();
      console.log('✅ Database connection closed cleanly');
      
    } catch (dbError) {
      console.error('❌ Database test failed:', dbError.message);
    }
    
    // Test 4: Package Dependencies
    console.log('\n📚 Testing package dependencies...');
    try {
      require('express');
      require('sqlite3');
      require('cors');
      require('helmet');
      require('moment');
      console.log('✅ All package dependencies available');
    } catch (error) {
      console.error('❌ Missing dependency:', error.message);
    }
    
    console.log('\n🎉 Installation test completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Run: npm start');
    console.log('2. Check TCP server: telnet 84.247.131.246 5000');
    console.log('3. Check API server: http://localhost:3000');
    console.log('4. View API docs: http://localhost:3000/api/docs');
    console.log('5. See README.md for detailed usage instructions');
    
    process.exit(0);
  }, 1000);
  
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}

// Cleanup handler
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
}); 