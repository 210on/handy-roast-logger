# Handy Roast Logger Design Guide

このアプリの設計判断は「焙煎中のユーザーが、画面を見続けなくても迷わないこと」を最優先にする。

## Product Principle

Handy Roast Logger は、データ分析ツールではなく、焙煎中に邪魔にならない記録補助ツール。

ユーザーが知りたい中心は次の3つ。

- 今、何分何秒か
- 今、温度と RoR はどう動いているか
- 最後に得られた roast curve は信頼してよいか

それ以外の情報は、CSV や Settings に逃がす。焙煎中の主画面には、操作判断に直接効く情報だけを置く。

## UX Rules

- 焙煎中の主操作は、左下のメインボタン1つを維持する。
- 新しい確認画面や modal は、事故を防ぐ効果が明確な場合だけ使う。
- 「何個欠損した」「何個補間した」のような内部処理の数値は、原則として主画面に出さない。
- 補間や外れ値除去は、ユーザーに処理詳細を見せるより、roast curve を自然に保つために使う。
- ユーザーへ出す警告は「次にどうすると良いか」がある場合だけにする。
- 数字を増やすより、グラフの読みやすさと信頼感を優先する。

## Visual Language

既存 UI に合わせ、派手な装飾や別世界のカードを追加しない。

- Background: `--bg-main` の薄いグレーを維持する。
- Surface: 白いカード、16px radius、弱い shadow を基本にする。
- Text: `--text-primary` と `--text-secondary` の2階調を中心にする。
- Accent: green / orange / red / save blue-gray は状態表現に限定する。
- Typography: system font、太い数字、tabular nums を維持する。
- Motion: 押下・表示切替の小さい transition だけにする。

新しい UI を作る場合は、既存の以下の形を再利用する。

- `stat-box`: 重要な現在値
- `weight-summary`: 焙煎後の簡潔な summary
- `settings-row`: 設定や補助情報
- `actionUI`: 焙煎中の操作と、その時だけ必要な追加情報

## Chart-First Design

roast curve が主役。補助情報はグラフの理解を助ける場合だけ表示する。

良い表示:

- curve の一部に薄い confidence 表現を重ねる
- 「この区間は推定を含みます」程度の短い注記
- 大きな外れ値を無視した場合に、ログや CSV へ理由を残す
- curve の精度を上げるための行動がある時だけ、控えめに促す

避ける表示:

- captured / interpolated / missed / ignored の数値 pill
- 欠損数だけを強調する post-roast summary
- グラフより目立つ data quality panel
- 焙煎中に判断できない診断情報

## Data Quality Policy

データ品質は「ユーザーに見せる情報」ではなく、まず「曲線を良くするための内部状態」として扱う。

- CSV には詳細を残してよい。
- UI では raw count よりも curve confidence を優先する。
- 補間が自然で roast curve の読み取りに問題がなければ、主画面で強調しない。
- 曲線の信頼性が明らかに落ちる場合だけ、短い説明を出す。
- 説明は「2 points missed」ではなく「この区間は推定が多めです」のように、焙煎判断に寄せる。

## Mockup Quality Bar

GUI 変更は、実装前に2案の HTML mockup を作る。ただし、mockup は次の条件を満たすこと。

- 既存の色・radius・shadow・font weight と馴染む。
- 新しいカードを足す前に、既存カードに統合できないか検討する。
- post-roast 画面でも、主役は roast curve と SAVE までの流れ。
- 情報量を増やす場合は、必ず「表示しない状態」を標準にする。
- mockup の説明には、どの issue の acceptance criteria を満たすかを書く。

## Issue Handling

GUI 変更を含む issue は、いきなり実装しない。

1. 既存 UI に馴染む2案の mockup を作る。
2. issue にリンクし、推奨案と理由を書く。
3. ユーザーが選ぶか、明確な方針が出た後に実装する。

ただし、見た目を変えないバグ修正、CSV改善、テスト追加、内部ロジック改善はそのまま実装してよい。

## Current Direction For Data Quality UI

#18 の data quality summary は、現状の mockup 方針を採用しない。

次に作るなら、次の方向にする。

- raw count の pill ではなく、roast curve の下に小さな confidence note を置く。
- 通常時は何も表示しない。
- 補間や欠損が多い場合だけ、post-roast に1行で「一部推定を含む曲線です」と出す。
- 詳細な captured / interpolated / missed / rejected は CSV の metadata に残す。
