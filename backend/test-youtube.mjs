/**
 * Comprehensive YouTube Backend Test Script
 * Tests all YouTube API functions with the provided video URL
 */

import fs from 'fs';

const BASE_URL = 'http://localhost:8787';
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=2Dt2DbjAKbo&t=4s';

const testResults = [];

async function testApi(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    const result = await testFn();
    testResults.push({ test: name, status: 'PASS', result, error: null });
    console.log(`✅ PASS: ${name}`);
    return result;
  } catch (error) {
    testResults.push({ test: name, status: 'FAIL', result: null, error: error.message });
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    return null;
  }
}

async function get(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'API Error');
  return data.data;
}

async function post(endpoint, body) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'API Error');
  return data.data;
}

async function del(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'API Error');
  return data.data;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('🎬 YouTube Backend Comprehensive Test Suite');
  console.log('='.repeat(70));
  console.log(`Test Video URL: ${TEST_VIDEO_URL}`);
  console.log('='.repeat(70));

  // 1. HEALTH & CONFIG
  console.log('\n📊 SECTION 1: HEALTH & CONFIG');
  console.log('-'.repeat(70));

  await testApi('Health Check', async () => {
    const result = await get('/api/youtube/health');
    return { python: result.python, node: result.node, platform: result.platform };
  });

  await testApi('Get Config', async () => {
    const config = await get('/api/youtube/config');
    return { credentialsPath: !!config.credentialsPath, downloadDirectory: config.downloadDirectory };
  });

  // 2. AUTHENTICATION
  console.log('\n🔐 SECTION 2: AUTHENTICATION');
  console.log('-'.repeat(70));

  await testApi('Get Auth Status', async () => {
    const auth = await get('/api/youtube/auth/status');
    return { ready: auth.ready, message: auth.message };
  });

  await testApi('Refresh Token', async () => {
    const result = await post('/api/youtube/auth/refresh');
    return result;
  });

  // 3. DOWNLOAD FUNCTIONALITY
  console.log('\n⬇️  SECTION 3: DOWNLOAD FUNCTIONALITY');
  console.log('-'.repeat(70));

  await testApi('Download Best MP4', async () => {
    const result = await post('/api/youtube/download', { url: TEST_VIDEO_URL });
    return { outputPath: result.outputPath };
  });

  await testApi('Fetch Video Chapters', async () => {
    const result = await post('/api/youtube/chapters', { sourceUrl: TEST_VIDEO_URL });
    return { videoId: result.videoId, videoTitle: result.videoTitle, chaptersCount: result.chapters.length };
  });

  await testApi('Fetch Transcript', async () => {
    const result = await post('/api/youtube/transcript', { source: TEST_VIDEO_URL });
    return { videoId: result.videoId, entryCount: result.entryCount, markdownLength: result.markdown.length };
  });

  // 4. CHANNEL & PLAYLIST MANAGEMENT
  console.log('\n📁 SECTION 4: CHANNEL & PLAYLIST MANAGEMENT');
  console.log('-'.repeat(70));

  await testApi('List Playlists', async () => {
    const playlists = await get('/api/youtube/playlists');
    return { count: playlists.length, firstPlaylist: playlists[0]?.title || 'none' };
  });

  let testPlaylistId = null;
  await testApi('Create Test Playlist', async () => {
    const result = await post('/api/youtube/playlists', {
      title: `Test Playlist - ${Date.now()}`,
      description: 'Created by automated test script',
      privacyStatus: 'unlisted'
    });
    testPlaylistId = result.id;
    return { id: result.id, title: result.title, privacyStatus: result.privacyStatus };
  });

  await testApi('List Channel Videos', async () => {
    const videos = await get('/api/youtube/channel/videos');
    return { count: videos.length, firstVideo: videos[0]?.title || 'none' };
  });

  if (testPlaylistId) {
    await testApi('Add Video to Playlist', async () => {
      // Extract video ID from test URL
      const videoId = '2Dt2DbjAKbo';
      const result = await post(`/api/youtube/playlists/${testPlaylistId}/videos`, { videoId });
      return result;
    });

    await testApi('List Playlist Videos', async () => {
      const videos = await get(`/api/youtube/playlists/${testPlaylistId}/videos`);
      return { count: videos.length };
    });
  }

  // 5. CHANNEL FETCH
  console.log('\n📡 SECTION 5: CHANNEL FETCH');
  console.log('-'.repeat(70));

  await testApi('Fetch Channel Report', async () => {
    // Test with a sample channel URL
    const result = await post('/api/youtube/fetch/channel', {
      channelUrl: 'https://www.youtube.com/@NBA'
    });
    return { channelTitle: result.channelTitle, videosCount: result.videos.length, markdownPath: result.markdownPath };
  });

  // 6. CLEANUP (delete test playlist)
  if (testPlaylistId) {
    console.log('\n🧹 SECTION 6: CLEANUP');
    console.log('-'.repeat(70));

    await testApi('Delete Test Playlist', async () => {
      const result = await del(`/api/youtube/playlists/${testPlaylistId}`);
      return { deleted: result.deleted };
    });
  }

  // ============================================================================
  // FINAL REPORT
  // ============================================================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 FINAL TEST REPORT');
  console.log('='.repeat(70));

  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${passRate}%)`);
  console.log(`❌ Failed: ${failed}`);

  console.log('\n' + '-'.repeat(70));
  console.log('DETAILED RESULTS:');
  console.log('-'.repeat(70));

  testResults.forEach((result, index) => {
    const emoji = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${emoji} ${index + 1}. ${result.test}`);
    if (result.status === 'PASS') {
      console.log(`   Result: ${JSON.stringify(result.result, null, 2).substring(0, 100)}...`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Save results to file
  const reportPath = 'test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testVideoUrl: TEST_VIDEO_URL,
    summary: { total, passed, failed, passRate },
    results: testResults
  }, null, 2));

  console.log('='.repeat(70));
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log('='.repeat(70));

  return { total, passed, failed, passRate };
}

// Run the tests
const results = await runAllTests();
console.log('\n🏁 Test suite completed with ' + results.passRate + '% pass rate.');
