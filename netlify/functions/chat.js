// npm パッケージ不要・Node.js 内蔵の fetch を使用する方式

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { answers } = JSON.parse(event.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key is not configured');
    }

    const systemPrompt = `あなたは松本さんのプライベート充実アドバイザーです。

【松本さんのプロフィール】
- 38歳男性、東京都大田区大森在住
- 趣味：登山（山登りが大好き）、サウナ、読書（自己啓発系）
- 家族：10ヶ月の赤ちゃんがいる
- 性格：アクティブで向上心が高い

ユーザーの回答に基づき、松本さんに最適なプライベート充実アイデアを5〜10個提案してください。

ルール：
- 必ず具体的で今日・今週すぐ実践できるアイデアにしてください
- 松本さんの趣味（山・サウナ・本）を積極的に絡めてください
- 大森・大田区周辺の具体的な場所や施設名も積極的に含めてください
- 赤ちゃんがいることを考慮した提案を混ぜてください
- 必ず以下のJSON形式のみで返してください（他の文章は不要）

{
  "ideas": [
    {
      "title": "アイデアのタイトル（20文字以内）",
      "description": "具体的な説明（50〜80文字）",
      "category": "山｜サウナ｜読書｜家族｜健康｜その他 のいずれか",
      "time": "所要時間の目安",
      "cost": "費用の目安（無料・〜500円・〜1000円・〜3000円・〜5000円・5000円以上）"
    }
  ]
}`;

    const userMessage = `【今日の松本さんの状況】
気分：${answers.mood}
使える時間：${answers.time}
誰と過ごすか：${answers.companion}
体力・エネルギー：${answers.energy}
予算感：${answers.budget}
屋内・屋外の好み：${answers.location}
今日の天気：${answers.weather}

この状況に合ったプライベート充実アイデアをJSON形式で提案してください。`;

    // npm パッケージ不要：Node.js 内蔵 fetch で Anthropic API を直接呼び出す
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);

      if (response.status === 429 || response.status === 529) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: 'budget_exceeded',
            message: '本月の利用上限に達しました。永野さんが再開許可を出すまでお待ちください。',
          }),
        };
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const ideas = JSON.parse(jsonMatch[0]);
      return { statusCode: 200, headers, body: JSON.stringify(ideas) };
    } else {
      throw new Error('Invalid response format');
    }

  } catch (error) {
    console.error('Function error:', error.message, error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'internal_error',
        message: `[詳細] ${error.message || 'Unknown error'} | Node: ${process.version}`,
      }),
    };
  }
};
