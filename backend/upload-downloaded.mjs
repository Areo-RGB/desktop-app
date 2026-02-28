/**
 * Download and Upload Video Script
 */

const VIDEO_URL = 'https://www.youtube.com/watch?v=2Dt2DbjAKbo&t=4s';
const BASE_URL = 'http://localhost:8787';

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

async function main() {
  console.log('='.repeat(70));
  console.log('🎬 Download and Upload YouTube Video');
  console.log('='.repeat(70));

  // Step 1: Download
  console.log('\n⬇️  Step 1: Downloading video...');
  console.log(`URL: ${VIDEO_URL}`);

  const downloadResult = await post('/api/youtube/download', { url: VIDEO_URL });
  console.log(`✅ Downloaded to: ${downloadResult.outputPath}`);

  const videoPath = downloadResult.outputPath;

  // Step 2: Upload
  console.log('\n⬆️  Step 2: Uploading video to YouTube...');
  console.log(`File: ${videoPath}`);

  const uploadResult = await post('/api/youtube/upload', {
    filePath: videoPath,
    title: 'Acceleration Training - Reupload Test'
  });

  console.log(`✅ Upload complete!`);
  console.log(`   Video ID: ${uploadResult.videoId}`);
  console.log(`   URL: ${uploadResult.url}`);

  console.log('\n' + '='.repeat(70));
  console.log('🏁 Process completed successfully!');
  console.log('='.repeat(70));

  return uploadResult;
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
