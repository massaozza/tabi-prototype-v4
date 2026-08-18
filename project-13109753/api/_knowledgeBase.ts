// TABI ローカル知識ベース（システムプロンプトに埋め込む元データ）
//
// 【重要】このファイルの中身は、Claudeが代わりに執筆すると
// ハルシネーション(実在しない店・情報)の温床になるため、意図的に生成していません。
// 以下は「データ構造の例」として1件だけ、広く知られた安全な事実を入れています。
// 残りはご自身の調査・知見で埋めてください（ロードマップPhase 1〜2に対応）。
//
// 各エントリの目安：
// - title: 30文字以内
// - story: 100〜200字程度。「なぜ地元の人が薦めるのか」が伝わる具体性を意識する
// - category: 'local' (地元感) | 'tip' (時間帯・裏技等) | 'seasonal' (季節限定)

export interface KnowledgeEntry {
  id: string;
  title: string;
  story: string;
  category: 'local' | 'tip' | 'seasonal';
  area: 'kamakura' | 'enoshima' | 'shonan';
}

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'example-01',
    title: '（記入例）鶴岡八幡宮は開門直後が空いている',
    story:
      '鶴岡八幡宮は日中、特に週末は観光客で賑わうが、開門直後の時間帯は比較的静かで、' +
      '境内をゆっくり歩ける。地元の人も朝の散歩や参拝にこの時間帯を選ぶことが多い。',
    category: 'tip',
    area: 'kamakura',
  },
  // ↓ここから実データに差し替えてください（Phase 1で5〜8件、Phase 2で15〜20件まで拡充）
  // {
  //   id: 'kamakura-02',
  //   title: '',
  //   story: '',
  //   category: 'local',
  //   area: 'kamakura',
  // },
];