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
- 38歳男性、東京都大田区大森在住（最寄り駅：JR大森駅・大井町線大岡山駅周辺）
- 趣味：登山（山登りが大好き）、サウナ、読書（自己啓発系）
- 家族：10ヶ月の赤ちゃんがいる
- 性格：アクティブで向上心が高い

【アクセス可能な実在施設リスト（必ずこの中から選ぶこと）】

▼ サウナ・銭湯（大田区・品川区近辺）
- ニュー小岩: 蒲田エリアの銭湯サウナ
- ゆ〜シティ蒲田: 大田区蒲田、天然温泉・サウナあり
- 蒲田温泉: 大田区蒲田、黒湯の天然温泉
- はすぬま温泉: 大田区西馬込、黒湯温泉
- 明神湯: 大田区大森、地元の銭湯
- 大井町 清水湯: 品川区大井町、サウナあり

▼ 登山・ハイキング（関東圏・日帰り可能）
- 高尾山: 東京都八王子市、大森から約1時間、初心者〜上級者まで
- 大山（丹沢）: 神奈川県伊勢原市、大森から約1.5時間
- 陣馬山: 東京都八王子市〜神奈川県、高尾山から縦走可能
- 御岳山: 東京都青梅市、奥多摩エリア
- 鋸山: 千葉県富津市、大森から約1.5時間

▼ 公園・散歩（大田区・周辺）
- 洗足池公園: 大田区、池畔の散歩、ベビーカーOK
- 多摩川土手: 大田区、ランニング・サイクリング
- 大森ふるさとの浜辺公園: 大田区、海沿いの公園
- 昭和記念公園: 立川市、広大な公園、ベビーカーOK

▼ 書店・図書館（大田区）
- 大田区立大森東図書館
- 大田区立蒲田図書館
- 大田区立洗足池図書館
- 紀伊國屋書店 羽田空港店
- TSUTAYA 大森山王店

【厳守ルール】
1. 施設名は必ず上記リストか、誰でも知っている全国チェーン店（スターバックス等）のみ使用すること
2. リストにない施設名は絶対に作らないこと（架空の施設名厳禁）
3. 山・登山スポットは必ず関東圏（東京・神奈川・千葉・埼玉・山梨）のみ提案すること
4. 施設名を出さない場合は「大田区内の銭湯」「近くの公園」など曖昧な表現にすること
5. 必ず具体的で今日・今週すぐ実践できるアイデアにすること
6. 松本さんの趣味（山・サウナ・本）を積極的に絡めること
7. 赤ちゃんがいることを考慮した提案を1〜2個混ぜること
8. 必ず以下のJSON形式のみで返すこと（他の文章は不要）

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
        model: 'claude-haiku-4-5',
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
