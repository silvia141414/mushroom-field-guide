# すーキノコ図鑑 PWA

## まずPCで起動
VS Codeでこのフォルダを開いて、Live Serverで `index.html` を開いてください。
`file://` 直開きだとService Workerが動かないので、Live Server等のローカルサーバーを使います。

## 今できること
- 写真付き発見記録
- 幼菌 / 成菌 / 老菌 / 不明
- 食用 / 毒 / 要注意 / 不明
- 場所・日付・メモ
- 図鑑一覧・検索・絞り込み
- 端末内保存
- JSONバックアップ書き出し / 読み込み
- PWA用manifest / Service Worker

## 次に追加する候補
- GPS緯度経度
- 発見マップ
- 1日の観察で複数種まとめて登録
- 幼菌/成菌/老菌ごとの複数写真
- Supabase/Firebase等でiPhoneとPC同期
- 同定自信度、似ているキノコ、学名