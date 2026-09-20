# Vegas Blackjack Trainer

ラスベガス旅行前のための、テンポ重視のブラックジャック実戦トレーニングWebアプリです。知識を読むだけではなく、カードを見る → Actionを選ぶ → Running Count / True Countを保つ、という流れを短い反復で練習します。

## 起動方法

```bash
npm install
npm run dev
```

`http://localhost:3000` を開きます。検証用コマンドは次のとおりです。

```bash
npm test
npm run build
```

## 使用技術

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS（CSS製Playing Card、フェルト、Shoe、Chip）
- Vitest（domain logicのunit test）
- 外部API・サーバー保存なし。Session内の成績は `sessionStorage` に保存

## 実装したトレーニング

- Basic Strategy / Speed Strategy（H/S/D/P/R keyboard shortcut、Fast Mode、応答時間）
- Hi-Lo Counting Level 1–4（1枚、連続表示、1 Player、複数Player）
- True Count と Deck Estimation（Easy / Realistic）
- Strategy Deviations（Illustrious 18 + Fab 4）
- Weakness Review（Situation、player total、dealer upcard、hand kind別）
- Full Table Simulation（実Shoe、Bet、Split、Double、Surrender、Insurance、Discard Tray、Cut Card）
- Casino Mode（ヒントを抑え、hand終了後にfeedback）

## 既定の Vegas 6-Deck rules

- 6 decks / 312 cards、Fisher–Yates shuffle、75% penetration
- Blackjack pays 3:2、Dealer H17、DAS、Late Surrender、Insurance
- Re-split up to four hands、Re-split Aces、split Acesはone-card only
- American hole card / dealer peek

`RULE SETTINGS` から deck数（1 / 2 / 6 / 8）、payout、H17/S17、DAS、Late Surrender、penetration、Re-split Aces、Insuranceを変更できます。ルール変更時には、物理的な整合性を保つため新しいShoeを開始します。

## Basic Strategy の前提

Strategy engineはUIから分離され、Hard / Soft / Pairとdealer upcardからActionを返します。4–8 deckの明示的なstrategy tableを基準に、H17/S17、DAS、Late Surrender、1/2 deckの代表的な差分を反映します。Split不可時は5,5をHard 10、10-value pairをHard 20として扱います。

Late Surrenderはdealer blackjackのpeek後にのみ利用可能です。Full TableではActionの合法性とBankrollをゲームエンジンが判定し、centsの整数演算で3:2、6:5、Double、Split、Push、Surrender、Insuranceを精算します。

参考: [Wizard of Odds — 4–8 Deck Basic Strategy](https://wizardofodds.com/games/blackjack/strategy/4-decks/)、[Late Surrender tables](https://wizardofodds.com/games/blackjack/surrender/)。

## Hi-Lo / True Count

- 2–6 = `+1`、7–9 = `0`、10/J/Q/K/A = `-1`
- Running CountはShoe開始時に0
- True Count = `Running Count / decks remaining`
- Full TableとTrue Count drillの整数回答は**truncate toward zero**を明示的に採用
- Index Playは**floor(TC)**で比較（負のTCもfloor）

Hi-Lo point valuesとRunning Countの説明は [Wizard of Odds — High-Low](https://wizardofodds.com/games/blackjack/card-counting/high-low/) を採用しています。

## Strategy Deviations の出典・前提

Illustrious 18 / Fab 4は Don Schlesinger『*Blackjack Attack*』の表を許可を得て再掲している [Wizard of OddsのHigh-Low table](https://wizardofodds.com/games/blackjack/card-counting/high-low/) を基準にしています。canonicalな6-deck S17 indicesに加え、H17/S17で変化する該当indexは [H17/S17 deviation comparison](https://www.blackjacktrainer.fyi/charts/deviations/s17) と照合し、コード内にも各行のsourceを残しています。

これは教育目的の標準的なindex setであり、すべてのカジノルール、penetration、rounding慣行、composition-dependent strategyを網羅するものではありません。

## テスト対象

- Deck: 6 decks = 312 cards、shuffle後の構成不変、cut card
- Hand: Ace処理、soft/hard、blackjack、bust、Dealer S17/H17
- Hi-Lo: 各tag、full deck = 0、True Count
- Strategy: hard / soft / pair、DAS、Late Surrender、H17/S17差分
- Settlement: win / loss / push / blackjack 3:2・6:5 / double / split / surrender / insurance
- Training session: stats、weakness、persistence、question generation

## 既知の制約

- `SOUND ON` は外部音源を使わず、Web Audio APIで短い操作音を生成します（デフォルトOFF）。ブラウザが音声を制限している場合も、ゲーム操作には影響しません。
- Full Tableは一人用のplayer decisionを正確に処理し、Hi-Lo Level 4で複数playerの視覚的なcount practiceを行います。複数playerの独立したBet/Actionを同時に自動playするcasino simulatorではありません。
- Card countingは期待値の条件を変え得ますが、短期的なVarianceをなくしたり、利益を保証したりしません。実際のtableでは掲示されたRulesを必ず確認してください。
