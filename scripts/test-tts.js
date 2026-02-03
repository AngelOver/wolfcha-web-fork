const https = require('https');
const fs = require('fs');

const API_BASE = 'https://one-api.bltcy.top';
const API_KEY = 'sk-xxurTEI3VN9Y7rChD49b8559E3B442B9954a9663C5C3B394';

// 测试文本
const testText = '你好，我是一个测试语音。这是一段用来测试语音合成效果的文字。';

// 测试 OpenAI 预设音色
const testCases = [
  { voice: 'alloy', desc: 'OpenAI 预设: alloy' },
  { voice: 'nova', desc: 'OpenAI 预设: nova' },
  { voice: 'shimmer', desc: 'OpenAI 预设: shimmer' },
];

async function testTTS(voice, desc) {
  console.log(`\n测试: ${desc}`);
  console.log(`Voice ID: ${voice}`);
  
  const payload = JSON.stringify({
    model: 'speech-01-turbo',
    input: testText,
    voice: voice,
    response_format: 'mp3'
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/v1/audio/speech`);
    
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        
        if (res.statusCode === 200) {
          const contentType = res.headers['content-type'];
          console.log(`✅ 成功! Content-Type: ${contentType}, Size: ${body.length} bytes`);
          
          // 保存音频文件
          const safeName = voice.replace(/[^a-zA-Z0-9-_]/g, '_');
          const filename = `test_${safeName}.mp3`;
          fs.writeFileSync(filename, body);
          console.log(`💾 已保存: ${filename}`);
          resolve({ success: true, voice, filename });
        } else {
          console.log(`❌ 失败! Status: ${res.statusCode}`);
          console.log(`Response: ${body.toString('utf8').slice(0, 500)}`);
          resolve({ success: false, voice, error: body.toString('utf8') });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`❌ 请求错误: ${e.message}`);
      resolve({ success: false, voice, error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== TTS API 测试 ===');
  console.log(`API: ${API_BASE}/v1/audio/speech`);
  console.log(`Model: speech-01-turbo`);
  
  const results = [];
  for (const tc of testCases) {
    const result = await testTTS(tc.voice, tc.desc);
    results.push(result);
  }
  
  console.log('\n=== 测试结果汇总 ===');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.voice}`);
  });
}

main().catch(console.error);
