# TUNL 10.1 - App Store Connect / Play Console copy (16 locales)

Theme: pure bug-fix release, no new gameplay. Achievements added in a past update
(ship unlocks, First Flight, planet/distance/score achievements, etc.) only ever fired
from the *live* moment their condition first became true - a returning player who'd
already unlocked ship 3, or already flown past a distance mark, before that achievement
shipped could never earn it, because the live trigger never fires twice. 10.1 adds a
one-time backfill pass (src/state.js) that checks currently-persisted state against
every achievement condition on load and retroactively grants anything already earned -
no replaying old milestones needed. GKAchievement.report() / AchievementsClient.unlock()
are both idempotent, so this is safe to run on every launch going forward too.

Two fields, two purposes:
- **Werbetexte** (App Store Connect "Promotional Text" only, 170-char limit) - reused
  verbatim from 9.1/10.0, since the core pitch hasn't changed. NOTE: 10.0's version of
  this field reset to EMPTY on ASC despite being filled for 9.1 (see
  store-metadata/10.0/release-notes.md) - always re-paste this field explicitly, every
  release, never assume it carried forward.
- **Neues in dieser Version** (What's New, version-specific) - real 10.1 content
  (the achievement backfill fix), under 500 chars/locale so it doubles as Google Play
  release notes if needed.

No em dashes anywhere (project rule) - hyphen-minus with spaces instead. Achievement
names are deliberately described generically ("unlocking a ship", "finishing your first
run") rather than quoting exact per-locale achievement titles, since those titles live
in App Store Connect / Play Console metadata, not this repo, and aren't available to
verify per language.

---

## Promotional Text (Werbetexte, 170-char limit, evergreen - same as 9.1/10.0)

### en
One cave a day, the same one for every player on Earth. Hold to climb, release to drop, and see how far you get before it is gone forever.

### de
Eine Höhle pro Tag, für alle Spieler weltweit dieselbe. Halten zum Steigen, loslassen zum Fallen. Wie weit kommst du, bevor sie für immer verschwindet?

### fr
Une grotte par jour, la même pour tous les joueurs du monde. Maintiens pour monter, relâche pour tomber. Jusqu'où iras-tu avant qu'elle disparaisse à jamais ?

### it
Una grotta al giorno, la stessa per ogni giocatore del mondo. Tieni premuto per salire, rilascia per scendere. Quanto arrivi prima che sparisca per sempre?

### es
Una cueva al día, la misma para cada jugador del mundo. Mantén para subir, suelta para caer. ¿Hasta dónde llegas antes de que desaparezca para siempre?

### pt (Portugal)
Uma gruta por dia, a mesma para todos os jogadores do mundo. Mantém premido para subir, larga para cair. Até onde chegas antes de ela desaparecer para sempre?

### pt-BR
Uma caverna por dia, a mesma para todos os jogadores do mundo. Segure para subir, solte para cair. Até onde você chega antes de ela sumir para sempre?

### ja
毎日ひとつの洞窟。世界中のプレイヤーが同じ洞窟を飛ぶ。押して上昇、離して落下。永遠に消える前にどこまで行けるか。

### ko
하루에 동굴 하나, 전 세계 플레이어가 똑같은 곳을 난다. 누르면 오르고, 손을 떼면 떨어진다. 영원히 사라지기 전에 얼마나 멀리 갈 수 있을까?

### zh
每天一個洞窟，全球玩家飛的都是同一個。按住上升，鬆開下降。在它永遠消失前，你能飛多遠？

### ru
Одна пещера в день, одна и та же для всех игроков мира. Держи, чтобы подниматься, отпусти, чтобы падать. Как далеко ты долетишь, пока она не исчезнет навсегда?

### ar
كهف واحد كل يوم، هو نفسه لكل لاعب في العالم. اضغط للصعود، اترك للهبوط. إلى أي مدى تصل قبل أن يختفي إلى الأبد؟

### tr
Günde bir mağara, dünyadaki her oyuncu için aynısı. Yükselmek için basılı tut, düşmek için bırak. Sonsuza dek kaybolmadan ne kadar ilerlersin?

### id
Satu gua per hari, sama untuk semua pemain di dunia. Tahan untuk naik, lepas untuk turun. Sejauh apa kamu bisa sebelum gua itu lenyap selamanya?

### vi
Mỗi ngày một hang, giống nhau với mọi người chơi trên thế giới. Giữ để bay lên, thả để rơi. Bạn bay được bao xa trước khi nó biến mất mãi mãi?

### hi
हर दिन एक गुफा, दुनिया के हर खिलाड़ी के लिए वही एक। ऊपर उठने के लिए दबाए रखें, गिरने के लिए छोड़ें। गायब होने से पहले आप कितनी दूर जाते हैं?

---

## What's New / Neues in dieser Version (version-specific, ~500 char budget)

### en
Fixed: achievements added after you'd already met their conditions - unlocking a ship, finishing your first run, and more - now unlock retroactively. No more missing badges for veteran pilots.

### de
Behoben: Erfolge, die eingeführt wurden, nachdem du ihre Bedingung schon erfüllt hattest - ein Schiff freischalten, deinen ersten Lauf beenden und mehr - werden jetzt rückwirkend vergeben. Keine fehlenden Abzeichen mehr für erfahrene Piloten.

### fr
Corrigé : les succès ajoutés après que tu avais déjà rempli leur condition - débloquer un vaisseau, terminer ta première partie, et plus - se débloquent désormais rétroactivement. Plus aucun badge manquant pour les pilotes vétérans.

### it
Risolto: gli obiettivi aggiunti dopo che ne avevi già soddisfatto la condizione - sbloccare una nave, completare la tua prima corsa e altro - ora si sbloccano retroattivamente. Niente più distintivi mancanti per i piloti veterani.

### es
Corregido: los logros añadidos después de que ya cumplieras su condición - desbloquear una nave, terminar tu primera partida y más - ahora se desbloquean de forma retroactiva. Nada de insignias perdidas para pilotos veteranos.

### pt (Portugal, also used for pt-BR)
Corrigido: as conquistas adicionadas depois de já teres cumprido a condição - desbloquear uma nave, terminar a tua primeira corrida e mais - agora desbloqueiam-se retroativamente. Sem mais emblemas em falta para pilotos veteranos.

### pt-BR
Corrigido: as conquistas adicionadas depois de você já ter cumprido a condição - desbloquear uma nave, terminar sua primeira corrida e mais - agora são desbloqueadas retroativamente. Sem mais emblemas faltando para pilotos veteranos.

### ja
修正：条件をすでに満たしていたのに反映されなかった実績（機体のアンロック、初めてのランの完走など）が、今後は遡って解除されるようになりました。ベテランパイロットのバッジ漏れはもうありません。

### ko
수정: 이미 조건을 충족한 뒤에 추가된 업적(기체 잠금 해제, 첫 런 완주 등)이 지급되지 않던 문제를 고쳤습니다. 이제부터는 소급 적용되어 지급됩니다. 베테랑 파일럿의 배지 누락은 이제 없습니다.

### zh
修正：如果你在某項成就推出前就已達成其條件（解鎖飛船、完成首次飛行等），現在會追溯授予該成就。資深飛行員不會再漏拿徽章。

### ru
Исправлено: достижения, добавленные уже после того, как ты выполнил их условие - разблокировка корабля, завершение первого забега и другое - теперь засчитываются задним числом. Больше никаких потерянных значков для опытных пилотов.

### ar
تم الإصلاح: الإنجازات التي أُضيفت بعد أن كنت قد استوفيت شرطها بالفعل - مثل فتح مركبة أو إنهاء أول جولة لك - تُمنح الآن بأثر رجعي. لا مزيد من الشارات المفقودة للطيارين المخضرمين.

### tr
Düzeltildi: koşulunu zaten sağladıktan sonra eklenen başarımlar - bir gemiyi açmak, ilk koşunu bitirmek ve daha fazlası - artık geriye dönük olarak açılıyor. Deneyimli pilotlar için eksik rozet kalmadı.

### id
Diperbaiki: pencapaian yang ditambahkan setelah kamu sudah memenuhi syaratnya - membuka kapal, menyelesaikan lari pertamamu, dan lainnya - kini terbuka secara retroaktif. Tidak ada lagi lencana yang terlewat untuk pilot veteran.

### vi
Đã sửa: những thành tựu được thêm sau khi bạn đã đủ điều kiện - mở khóa tàu, hoàn thành lượt bay đầu tiên, và hơn thế - giờ sẽ được cấp hồi tố. Không còn huy hiệu bị bỏ sót cho phi công kỳ cựu.

### hi
ठीक किया गया: जो उपलब्धियां आपके उनकी शर्त पहले ही पूरी करने के बाद जोड़ी गईं - जैसे शिप अनलॉक करना, अपना पहला रन पूरा करना और अन्य - अब पूर्वव्यापी रूप से मिलेंगी। अनुभवी पायलटों के लिए अब कोई बैज नहीं छूटेगा।
