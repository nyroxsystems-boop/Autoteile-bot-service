/**
 * 🌍 BOT RESPONSES — Centralized i18n Response Templates
 *
 * All bot-facing text in one place. 5 languages: DE, EN, TR, KU, PL.
 * Consistent "Sie"-Form (professional B2B tone).
 *
 * Usage: import { t } from './botResponses';
 *        t('collect_vehicle', language)
 */

export type SupportedLanguage = 'de' | 'en' | 'tr' | 'ku' | 'pl';

type ResponseKey =
    | 'greeting_after_language'
    | 'collect_vehicle_photo'
    | 'collect_vehicle_manual'
    | 'collect_part'
    | 'collect_part_position'
    | 'collect_part_fallback'
    | 'ocr_success'
    | 'ocr_partial'
    | 'ocr_failed'
    | 'ocr_vin_missing'
    | 'ocr_photo_failed'
    | 'oem_searching'
    | 'oem_found'
    | 'oem_not_found'
    | 'oem_timeout'
    | 'oem_product_found'
    | 'oem_product_uncertain'
    | 'oem_scrape_failed'
    | 'oem_tech_error'
    | 'vehicle_incomplete'
    | 'vehicle_need_more'
    | 'vehicle_confirm'
    | 'vehicle_correction'
    | 'doc_hint'
    | 'ask_brand'
    | 'ask_model'
    | 'ask_vin_general'
    | 'caution_check'
    | 'part_mentioned'
    | 'offers_intro'
    | 'no_offers'
    | 'offer_collecting'
    | 'offer_binding_note'
    | 'offer_multi_binding'
    | 'offer_pickup'
    | 'offer_delivery'
    | 'offer_single_header'
    | 'offer_multi_header'
    | 'offer_choose_prompt'
    | 'offer_order_prompt'
    | 'offer_choice_invalid'
    | 'offer_choice_not_found'
    | 'offer_confirmed_choice'
    | 'offer_confirm_prompt'
    | 'offer_decline_alt'
    | 'offer_lost'
    | 'offer_not_found'
    | 'offer_fetch_failed'
    | 'confirm_vehicle_yes'
    | 'delivery_or_pickup'
    | 'delivery_ask_address'
    | 'pickup_location'
    | 'address_saved'
    | 'address_invalid'
    | 'fresh_start'
    | 'follow_up_part'
    | 'follow_up_fallback'
    | 'goodbye'
    | 'order_complete'
    | 'delivery_or_pickup_ask'
    | 'offer_confirmed'
    | 'order_confirmed'
    | 'order_another_part'
    | 'order_new_vehicle'
    | 'farewell'
    | 'frustration_apology'
    | 'abuse_warning'
    | 'cancel_order'
    | 'status_multi_ticket'
    | 'global_fallback'
    | 'session_timeout'
    | 'typing_indicator';

const responses: Record<ResponseKey, Record<SupportedLanguage, string>> = {

    greeting_after_language: {
        de: 'Super! 🎉 Schicken Sie mir bitte ein Foto Ihres Fahrzeugscheins, oder nennen Sie mir: Marke, Modell, Baujahr.',
        en: 'Great! 🎉 Please send me a photo of your vehicle registration document, or tell me: make, model, year.',
        tr: 'Harika! 🎉 Lütfen araç ruhsatınızın fotoğrafını gönderin veya marka, model, yıl bilgilerini yazın.',
        ku: 'Baş e! 🎉 Ji kerema xwe wêneya belgeya qeydkirina wesayîta xwe bişînin, an jî marka, model, sal binivîsin.',
        pl: 'Świetnie! 🎉 Wyślij mi zdjęcie dowodu rejestracyjnego pojazdu lub podaj: markę, model, rok.',
    },

    collect_vehicle_photo: {
        de: '📸 Schicken Sie mir bitte ein Foto Ihres Fahrzeugscheins – ich lese die Daten automatisch aus.',
        en: '📸 Please send me a photo of your vehicle registration – I\'ll read the data automatically.',
        tr: '📸 Lütfen araç ruhsatınızın fotoğrafını gönderin – verileri otomatik okuyacağım.',
        ku: '📸 Ji kerema xwe wêneya belgeya qeydkirina wesayîta xwe bişînin – ez ê daneyan bixweber bixwînim.',
        pl: '📸 Wyślij mi zdjęcie dowodu rejestracyjnego – automatycznie odczytam dane.',
    },

    collect_vehicle_manual: {
        de: 'Bitte nennen Sie mir VIN, HSN/TSN oder mindestens Marke, Modell und Baujahr, damit ich Ihr Fahrzeug identifizieren kann.',
        en: 'Please provide your VIN, HSN/TSN, or at least make, model, and year so I can identify your vehicle.',
        tr: 'Lütfen VIN, HSN/TSN veya en azından marka, model ve yıl bilgilerini yazın, aracınızı tanımlayabilmem için.',
        ku: 'Ji kerema xwe VIN, HSN/TSN an jî herî kêm marka, model û sal binivîsin da ku ez karibim wesayîta we nas bikim.',
        pl: 'Proszę podać VIN, HSN/TSN lub przynajmniej markę, model i rok, abym mógł zidentyfikować pojazd.',
    },

    collect_part: {
        de: 'Welches Teil benötigen Sie? Bitte nennen Sie auch die Position (vorne/hinten, links/rechts) falls relevant.',
        en: 'Which part do you need? Please also mention the position (front/rear, left/right) if applicable.',
        tr: 'Hangi parçaya ihtiyacınız var? Lütfen pozisyonu da belirtin (ön/arka, sol/sağ).',
        ku: 'Kîjan perçe hewce ye? Ji kerema xwe pozîsyonê jî binivîsin (pêş/paş, çep/rast).',
        pl: 'Jakiej części potrzebujesz? Podaj też pozycję (przód/tył, lewa/prawa) jeśli to istotne.',
    },

    collect_part_position: {
        de: 'Für welche Seite/Achse benötigen Sie das Teil? Zum Beispiel: vorne links, vorne rechts, hinten links, hinten rechts.',
        en: 'For which side/axle do you need the part? For example: front left, front right, rear left, rear right.',
        tr: 'Parçayı hangi taraf/aks için istiyorsunuz? Örneğin: ön sol, ön sağ, arka sol, arka sağ.',
        ku: 'Perçe ji bo kîjan alî/axê hewce ye? Mînak: pêş çep, pêş rast, paş çep, paş rast.',
        pl: 'Na którą stronę/oś potrzebujesz część? Na przykład: przód lewy, przód prawy, tył lewy, tył prawy.',
    },

    ocr_success: {
        de: '✅ Fahrzeugschein erkannt! Welches Teil benötigen Sie?',
        en: '✅ Vehicle document recognized! Which part do you need?',
        tr: '✅ Araç belgesi tanındı! Hangi parçaya ihtiyacınız var?',
        ku: '✅ Belgeya wesayîtê hat naskirin! Kîjan perçe hewce ye?',
        pl: '✅ Dowód rejestracyjny rozpoznany! Jakiej części potrzebujesz?',
    },

    ocr_partial: {
        de: '⚠️ Ich konnte einige Daten aus Ihrem Fahrzeugschein lesen, aber nicht alle. Können Sie bitte die fehlenden Angaben ergänzen?',
        en: '⚠️ I could read some data from your document, but not all. Could you please provide the missing information?',
        tr: '⚠️ Belgenizden bazı verileri okuyabildim ama hepsini değil. Eksik bilgileri tamamlayabilir misiniz?',
        ku: '⚠️ Min karî çend daneyan ji belgeya we bixwînim lê ne hemî. Hûn dikarin agahdariya winda temam bikin?',
        pl: '⚠️ Udało mi się odczytać niektóre dane, ale nie wszystkie. Czy możesz uzupełnić brakujące informacje?',
    },

    ocr_failed: {
        de: '📷 Leider konnte ich das Foto nicht gut lesen. Können Sie es nochmal mit besserer Beleuchtung versuchen, oder mir die Fahrzeugdaten direkt nennen? (Marke, Modell, Baujahr)',
        en: '📷 I couldn\'t read your photo clearly. Could you try again with better lighting, or tell me your vehicle details directly? (Make, model, year)',
        tr: '📷 Fotoğrafı net okuyamadım. Daha iyi aydınlatma ile tekrar deneyebilir misiniz veya araç bilgilerini doğrudan yazabilir misiniz? (Marka, model, yıl)',
        ku: '📷 Min nekarî wêne baş bixwînim. Hûn dikarin bi ronahiyek çêtir dîsa biceribînin, an jî agahdariya wesayîtê rasterast binivîsin? (Marka, model, sal)',
        pl: '📷 Nie udało się odczytać zdjęcia. Czy możesz spróbować ponownie z lepszym oświetleniem lub podać dane pojazdu bezpośrednio? (Marka, model, rok)',
    },

    oem_searching: {
        de: '🔍 Ich suche jetzt die passende OEM-Nummer für Ihr Fahrzeug. Das kann einen Moment dauern...',
        en: '🔍 I\'m searching for the correct OEM number for your vehicle. This may take a moment...',
        tr: '🔍 Aracınız için doğru OEM numarasını arıyorum. Bu biraz zaman alabilir...',
        ku: '🔍 Ez li jimareya OEM-ê ya rast ji bo wesayîta we digerim. Ev dikare hinekî dem bigire...',
        pl: '🔍 Szukam właściwego numeru OEM dla Twojego pojazdu. To może chwilę potrwać...',
    },

    oem_found: {
        de: '✅ OEM-Nummer gefunden! Ich suche jetzt Angebote für Sie...',
        en: '✅ OEM number found! I\'m now searching for offers...',
        tr: '✅ OEM numarası bulundu! Şimdi teklifler arıyorum...',
        ku: '✅ Jimareya OEM hat dîtin! Niha ez li pêşniyaran digerim...',
        pl: '✅ Numer OEM znaleziony! Szukam teraz ofert...',
    },

    oem_not_found: {
        de: '❌ Leider konnte ich keine passende OEM-Nummer finden. Ich leite Ihre Anfrage an einen Experten weiter.',
        en: '❌ Unfortunately I couldn\'t find a matching OEM number. I\'m forwarding your request to an expert.',
        tr: '❌ Maalesef uygun bir OEM numarası bulamadım. Talebinizi bir uzmana yönlendiriyorum.',
        ku: '❌ Mixabin min nekarî jimareyek OEM-ê ya rast bibînim. Ez daxwaziya we ji pispor re dişînim.',
        pl: '❌ Niestety nie udało się znaleźć pasującego numeru OEM. Przekazuję zapytanie do eksperta.',
    },

    oem_timeout: {
        de: '⏳ Die OEM-Suche dauert länger als erwartet. Ich arbeite im Hintergrund weiter und melde mich, sobald ich ein Ergebnis habe.',
        en: '⏳ OEM search is taking longer than expected. I\'ll keep working and get back to you with results.',
        tr: '⏳ OEM araması beklenenden uzun sürüyor. Arka planda çalışmaya devam ediyorum, sonuç aldığımda size bildireceğim.',
        ku: '⏳ Lêgerîna OEM ji ya hêvîkirî dirêjtir e. Ez li paş perdeyan dixebitim û dema ku encam hebin, ji we re dibêjim.',
        pl: '⏳ Wyszukiwanie OEM trwa dłużej niż oczekiwano. Pracuję w tle i wrócę z wynikami.',
    },

    vehicle_incomplete: {
        de: 'Mir fehlen noch einige Fahrzeugdaten. Können Sie mir bitte noch folgende Angaben machen?',
        en: 'I\'m missing some vehicle details. Could you please provide the following information?',
        tr: 'Bazı araç bilgileri eksik. Lütfen aşağıdaki bilgileri verir misiniz?',
        ku: 'Çend agahdariyên wesayîtê kêm in. Hûn dikarin agahdariyên jêrîn bidin?',
        pl: 'Brakuje mi kilku danych pojazdu. Czy możesz podać następujące informacje?',
    },

    offers_intro: {
        de: '📋 Hier sind die Angebote für Ihr Teil:',
        en: '📋 Here are the offers for your part:',
        tr: '📋 Parçanız için teklifler:',
        ku: '📋 Ji bo perçeya we ev pêşniyar in:',
        pl: '📋 Oto oferty na Twoją część:',
    },

    no_offers: {
        de: '😕 Leider habe ich aktuell keine Angebote gefunden. Ich leite Ihre Anfrage an einen Experten weiter.',
        en: '😕 Unfortunately I couldn\'t find any offers right now. I\'m forwarding your request to an expert.',
        tr: '😕 Maalesef şu anda teklif bulamadım. Talebinizi bir uzmana yönlendiriyorum.',
        ku: '😕 Mixabin niha min nekarî pêşniyar bibînim. Ez daxwaziya we ji pispor re dişînim.',
        pl: '😕 Niestety nie znalazłem żadnych ofert. Przekazuję zapytanie do eksperta.',
    },

    order_confirmed: {
        de: '✅ Vielen Dank! Ihre Bestellung wurde gespeichert. Wir melden uns zeitnah bei Ihnen.',
        en: '✅ Thank you! Your order has been saved. We\'ll get back to you shortly.',
        tr: '✅ Teşekkürler! Siparişiniz kaydedildi. En kısa sürede size geri dönüş yapacağız.',
        ku: '✅ Spas! Siparîşa we hat tomarkirin. Em ê di demek nêzîk de vegerin.',
        pl: '✅ Dziękuję! Zamówienie zostało zapisane. Wkrótce się odezwiemy.',
    },

    order_another_part: {
        de: 'Möchten Sie ein weiteres Teil für dasselbe Fahrzeug suchen?',
        en: 'Would you like to search for another part for the same vehicle?',
        tr: 'Aynı araç için başka bir parça aramak ister misiniz?',
        ku: 'Hûn dixwazin ji bo heman wesayîtê perçeyek din bigerin?',
        pl: 'Czy chcesz poszukać innej części dla tego samego pojazdu?',
    },

    order_new_vehicle: {
        de: 'Gerne! Bitte geben Sie die Daten Ihres neuen Fahrzeugs an.',
        en: 'Sure! Please provide the details of your new vehicle.',
        tr: 'Tabii! Lütfen yeni aracınızın bilgilerini verin.',
        ku: 'Erê! Ji kerema xwe agahdariyên wesayîta xwe ya nû bidin.',
        pl: 'Jasne! Podaj dane nowego pojazdu.',
    },

    farewell: {
        de: 'Vielen Dank für Ihre Anfrage! Bei weiteren Fragen stehe ich Ihnen gerne zur Verfügung. 👋',
        en: 'Thank you for your inquiry! Feel free to reach out if you need anything else. 👋',
        tr: 'Talebiniz için teşekkürler! Başka sorunuz olursa bize ulaşabilirsiniz. 👋',
        ku: 'Spas ji bo daxwaziya we! Heke pirsên din hebin, em amade ne. 👋',
        pl: 'Dziękuję za zapytanie! W razie pytań proszę się nie wahać. 👋',
    },

    frustration_apology: {
        de: 'Entschuldigung für die Unannehmlichkeiten! Ich versuche, Ihnen so schnell wie möglich zu helfen.',
        en: 'I apologize for the inconvenience! I\'m trying to help you as quickly as possible.',
        tr: 'Rahatsızlık için özür dilerim! Size en kısa sürede yardımcı olmaya çalışıyorum.',
        ku: 'Lêborîn ji bo nerehetiyê! Ez hewl didim ku bi lez ji we re bibin alîkar.',
        pl: 'Przepraszam za niedogodności! Staram się pomóc jak najszybciej.',
    },

    abuse_warning: {
        de: 'Bitte verzichten Sie auf Beleidigungen. Ich helfe Ihnen gern weiter, wenn wir sachlich kommunizieren.',
        en: 'Please refrain from insults. I\'m happy to help if we communicate respectfully.',
        tr: 'Lütfen hakaretlerden kaçının. Saygılı bir şekilde iletişim kurarsak yardımcı olmaktan memnuniyet duyarım.',
        ku: 'Ji kerema xwe ji heqaretan dûr bimînin. Heke em bi rêzdarî pêwendiyê bikin, ez kêfxweş im ku alikariyê bikim.',
        pl: 'Proszę powstrzymać się od obraźliwych słów. Chętnie pomogę, jeśli będziemy rozmawiać z szacunkiem.',
    },

    session_timeout: {
        de: '👋 Hallo! Sind Sie noch da? Ich kann Ihnen weiterhin bei der Teilebeschaffung helfen.',
        en: '👋 Hello! Are you still there? I can continue helping you find the right part.',
        tr: '👋 Merhaba! Hâlâ burada mısınız? Size parça bulmada yardımcı olmaya devam edebilirim.',
        ku: '👋 Silav! Hûn hîn li vir in? Ez dikarim berdewam bikim ku ji we re perçeya rast bibînim.',
        pl: '👋 Cześć! Czy nadal jesteś? Mogę dalej pomagać w znalezieniu odpowiedniej części.',
    },


    caution_check: {
        de: ' (bitte kurz prüfen)',
        en: ' (please double-check)',
        tr: ' (lütfen kontrol edin)',
        ku: ' (ji kerema xwe kontrol bikin)',
        pl: ' (proszę sprawdzić)',
    },

    part_mentioned: {
        de: 'das genannte Teil',
        en: 'the part you mentioned',
        tr: 'bahsettiğiniz parça',
        ku: 'perçeya ku we got',
        pl: 'wspomniana część',
    },

    vehicle_correction: {
        de: 'Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.',
        en: 'Oh, I\'m sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car.',
        tr: 'Özür dilerim. Lütfen ruhsat fotoğrafı veya doğru VIN gönderin, aracınızı belirleyebileyim.',
        ku: 'Bibore, ez xemgîn im. Ji kerema xwe wêneya belgeyê an VIN-a rast bişînin da ku ez wesayîta rast nas bikim.',
        pl: 'Przepraszam. Proszę wysłać zdjęcie dowodu rejestracyjnego lub poprawny VIN, abym mógł zidentyfikować właściwy pojazd.',
    },

    confirm_vehicle_yes: {
        de: 'Welches Teil suchen Sie? Bitte nennen Sie die Position und eventuelle Symptome.',
        en: 'Which part do you need? Please include position and symptoms.',
        tr: 'Hangi parçaya ihtiyacınız var? Lütfen pozisyon ve belirtileri de belirtin.',
        ku: 'Hûn kîjan perçeyê hewce ne? Ji kerema xwe cih û nîşaneyan jî binivîsin.',
        pl: 'Jakiej części potrzebujesz? Proszę podać pozycję i objawy.',
    },

    offer_collecting: {
        de: 'Ich suche noch passende Angebote. Sie bekommen gleich eine Auswahl.',
        en: 'I\'m still collecting offers for you. You\'ll get a selection shortly.',
        tr: 'Sizin için hâlâ teklifler topluyorum. Kısa sürede bir seçenek alacaksınız.',
        ku: 'Ez hê jî ji bo we pêşniyaran kom dikim. Hûn ê di demek kurt de vebijarkek bistînin.',
        pl: 'Wciąż zbieram dla Ciebie oferty. Wkrótce otrzymasz wybór.',
    },

    offer_binding_note: {
        de: '\n\n⚠️ HINWEIS: Mit Ihrer Bestätigung geben Sie ein verbindliches Kaufangebot bei Ihrem Händler ab.',
        en: '\n\n⚠️ NOTE: This offer is a binding purchase agreement.',
        tr: '\n\n⚠️ NOT: Bu teklif bağlayıcı bir satın alma sözleşmesidir.',
        ku: '\n\n⚠️ ZANÎN: Ev pêşniyar peymanek kirînê ya girêdayî ye.',
        pl: '\n\n⚠️ UWAGA: Ta oferta stanowi wiążącą umowę kupna.',
    },

    offer_multi_binding: {
        de: '\n\n⚠️ Die Auswahl einer Option gilt als verbindliches Kaufangebot.',
        en: '\n\n⚠️ Selecting an option constitutes a binding purchase agreement.',
        tr: '\n\n⚠️ Bir seçenek belirlemek bağlayıcı bir satın alma sözleşmesi oluşturur.',
        ku: '\n\n⚠️ Hilbijartina vebijarkekê peymanek kirînê ya girêdayî çêdike.',
        pl: '\n\n⚠️ Wybór opcji stanowi wiążącą umowę kupna.',
    },

    offer_pickup: {
        de: '📦 *Sofort abholbereit!*',
        en: '📦 *Available for immediate pickup!*',
        tr: '📦 *Hemen teslim alınabilir!*',
        ku: '📦 *Tavilê amade ye ji bo wergirtinê!*',
        pl: '📦 *Dostępne do natychmiastowego odbioru!*',
    },

    offer_delivery: {
        de: '🚚 *Lieferzeit:* {delivery} Tage',
        en: '🚚 *Delivery:* {delivery} days',
        tr: '🚚 *Teslimat:* {delivery} gün',
        ku: '🚚 *Gihandina:* {delivery} roj',
        pl: '🚚 *Dostawa:* {delivery} dni',
    },

    offer_single_header: {
        de: '✅ *Perfektes Angebot gefunden!*',
        en: '✅ *Perfect Match Found!*',
        tr: '✅ *Mükemmel Eşleşme Bulundu!*',
        ku: '✅ *Lihevhatina Bêkêmasî Hat Dîtin!*',
        pl: '✅ *Znaleziono idealne dopasowanie!*',
    },

    offer_multi_header: {
        de: '✅ *Ich habe mehrere Angebote gefunden!*\n\nBitte wählen Sie eines:',
        en: '✅ *I found multiple offers!*\n\nPlease choose one:',
        tr: '✅ *Birden fazla teklif buldum!*\n\nLütfen birini seçin:',
        ku: '✅ *Min gelek pêşniyar dîtin!*\n\nJi kerema xwe yekê hilbijêrin:',
        pl: '✅ *Znalazłem kilka ofert!*\n\nProszę wybrać jedną:',
    },

    offer_choose_prompt: {
        de: '👉 Antworten Sie mit *1*, *2* oder *3*.',
        en: '👉 Reply with *1*, *2* or *3*.',
        tr: '👉 *1*, *2* veya *3* ile yanıtlayın.',
        ku: '👉 Bi *1*, *2* an *3* bersiv bidin.',
        pl: '👉 Odpowiedz *1*, *2* lub *3*.',
    },

    offer_order_prompt: {
        de: 'Jetzt verbindlich bestellen?',
        en: 'Do you want to order this now?',
        tr: 'Şimdi sipariş vermek ister misiniz?',
        ku: 'Ma hûn dixwazin niha fermanê bidin?',
        pl: 'Czy chcesz teraz zamówić?',
    },

    offer_choice_invalid: {
        de: 'Bitte antworten Sie mit 1, 2 oder 3, um ein Angebot auszuwählen.',
        en: 'Please reply with 1, 2 or 3 to pick one of the offers.',
        tr: 'Lütfen tekliflerden birini seçmek için 1, 2 veya 3 ile yanıtlayın.',
        ku: 'Ji kerema xwe bi 1, 2 an 3 bersiv bidin da ku yek ji pêşniyaran hilbijêrin.',
        pl: 'Proszę odpowiedzieć 1, 2 lub 3, aby wybrać jedną z ofert.',
    },

    offer_choice_not_found: {
        de: 'Ich konnte Ihre Auswahl nicht zuordnen. Ich zeige Ihnen die Angebote erneut.',
        en: 'I couldn\'t match your choice. I\'ll show the offers again.',
        tr: 'Seçiminizi eşleştiremedim. Teklifleri tekrar göstereceğim.',
        ku: 'Min nekarî vebijarka we lihev bikim. Ez ê pêşniyaran dîsa nîşan bidim.',
        pl: 'Nie udało się dopasować wyboru. Pokażę oferty ponownie.',
    },

    offer_confirmed_choice: {
        de: 'Vielen Dank! Ihre Bestellung ({orderId}) wurde mit dem Angebot von {shop} ({brand}, {price} {currency}) gespeichert. Dies ist nun eine verbindliche Bestellung. Ihr Händler wird Sie bald kontaktieren.',
        en: 'Thank you! Your order ({orderId}) has been saved with the offer from {shop} ({brand}, {price} {currency}). This is now a binding agreement. Your dealer will contact you soon.',
        tr: 'Teşekkürler! Siparişiniz ({orderId}) {shop} teklifleriyle ({brand}, {price} {currency}) kaydedildi. Bu artık bağlayıcı bir anlaşmadır. Bayiniz yakında sizinle iletişime geçecek.',
        ku: 'Spas! Fermana we ({orderId}) bi pêşniyara {shop} ({brand}, {price} {currency}) hat tomarkirin. Ev niha peymanek girêdayî ye. Firoşkarê we dê zû bi we re têkilî daynin.',
        pl: 'Dziękuję! Zamówienie ({orderId}) zostało zapisane z ofertą od {shop} ({brand}, {price} {currency}). To jest teraz wiążąca umowa. Dealer wkrótce się z Tobą skontaktuje.',
    },

    offer_confirm_prompt: {
        de: 'Wenn das Angebot für Sie passt, antworten Sie bitte mit "Ja" oder "OK". Wenn nicht, sagen Sie mir kurz, was Ihnen wichtig ist (z.B. Preis, Marke oder Lieferzeit).',
        en: 'If this offer works for you, please reply with "Yes" or "OK". If not, tell me what matters most (price, brand, delivery time).',
        tr: 'Bu teklif sizin için uygunsa, lütfen "Evet" veya "OK" ile yanıtlayın. Değilse, en önemli olanı söyleyin (fiyat, marka, teslimat süresi).',
        ku: 'Heke ev pêşniyar ji bo we maqûl e, ji kerema xwe bi "Erê" an "OK" bersiv bidin. Heke na, ji min re bibêjin çi girîng e (bihayê, marka, dema gihandina).',
        pl: 'Jeśli ta oferta Ci odpowiada, odpowiedz "Tak" lub "OK". Jeśli nie, powiedz mi, co jest najważniejsze (cena, marka, czas dostawy).',
    },

    offer_decline_alt: {
        de: 'Alles klar, ich schaue, ob ich Ihnen noch andere Angebote finden kann. Sagen Sie mir gerne, was Ihnen wichtiger ist: Preis, Marke oder Lieferzeit.',
        en: 'Got it, I\'ll see if I can find alternative offers. Tell me what matters most: price, brand or delivery time.',
        tr: 'Anladım, alternatif teklifler bulabilir miyim bakacağım. En önemli olanı söyleyin: fiyat, marka veya teslimat süresi.',
        ku: 'Baş e, ez ê bibînim ka ez dikarim pêşniyarên din bibînim. Ji min re bibêjin çi girîngtir e: bihayê, marka an dema gihandina.',
        pl: 'Rozumiem, zobaczę czy znajdę alternatywne oferty. Powiedz mi, co jest najważniejsze: cena, marka czy czas dostawy.',
    },

    offer_lost: {
        de: 'Ich habe das Angebot nicht mehr parat. Ich hole die Optionen nochmal.',
        en: 'I lost track of the offer. I\'ll fetch the options again.',
        tr: 'Teklifi kaybettim. Seçenekleri tekrar getireceğim.',
        ku: 'Min pêşniyar winda kir. Ez ê vebijarkên dîsa bînim.',
        pl: 'Straciłem ślad oferty. Pobieram opcje ponownie.',
    },

    offer_not_found: {
        de: 'Ich konnte dieses Angebot nicht mehr finden. Ich zeige Ihnen die verfügbaren Angebote erneut.',
        en: 'I couldn\'t find that offer anymore. I\'ll show available offers again.',
        tr: 'Bu teklifi artık bulamadım. Mevcut teklifleri tekrar göstereceğim.',
        ku: 'Min êdî nekarî vê pêşniyarê bibînim. Ez ê pêşniyarên berdest dîsa nîşan bidim.',
        pl: 'Nie mogę już znaleźć tej oferty. Pokażę dostępne oferty ponownie.',
    },

    offer_fetch_failed: {
        de: 'Ich konnte gerade keine Angebote abrufen. Ich melde mich bald erneut.',
        en: 'I couldn\'t retrieve offers right now. I\'ll update you soon.',
        tr: 'Şu anda teklifleri alamadım. Yakında size bilgi vereceğim.',
        ku: 'Min niha nekarî pêşniyaran bistînim. Ez ê zû we agahdar bikim.',
        pl: 'Nie udało się pobrać ofert. Wkrótce się odezwę.',
    },

    offer_confirmed: {
        de: 'Perfekt, ich habe dieses Angebot für Sie gespeichert. Ihre Bestellung ({orderId}) ist nun verbindlich. Ihr Händler wird Sie bald kontaktieren.',
        en: 'Perfect, I\'ve saved this offer for you. Your order ({orderId}) is now binding. Your dealer will contact you soon.',
        tr: 'Mükemmel, bu teklifi sizin için kaydettim. Siparişiniz ({orderId}) artık bağlayıcıdır. Bayiniz yakında sizinle iletişime geçecek.',
        ku: 'Bêkêmasî, min ev pêşniyar ji bo we tomar kir. Fermana we ({orderId}) niha girêdayî ye. Firoşkarê we dê zû bi we re têkilî daynin.',
        pl: 'Doskonale, zapisałem tę ofertę. Zamówienie ({orderId}) jest teraz wiążące. Dealer wkrótce się skontaktuje.',
    },

    delivery_or_pickup: {
        de: 'Möchten Sie das Teil nach Hause geliefert bekommen (D) oder holen Sie es beim Händler ab (P)?',
        en: 'Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?',
        tr: 'Parçanın eve teslim edilmesini mi (D) yoksa bayiden teslim almayı mı (P) tercih edersiniz?',
        ku: 'Ma hûn dixwazin perçe were malê we (D) an hûn dixwazin ji firoşkar bistînin (P)?',
        pl: 'Czy chcesz dostawę do domu (D) czy odbiór u dealera (P)?',
    },

    delivery_ask_address: {
        de: 'Sehr gute Wahl. Bitte senden Sie mir nun Ihre vollständige Lieferadresse.',
        en: 'Excellent choice. Please send me your full delivery address.',
        tr: 'Mükemmel seçim. Lütfen tam teslimat adresinizi gönderin.',
        ku: 'Vebijarkek hêja. Ji kerema xwe navnîşana gihandina xwe ya tevahî bişînin.',
        pl: 'Świetny wybór. Proszę podać pełny adres dostawy.',
    },

    pickup_location: {
        de: 'Perfekt! Sie können das Teil hier abholen: {location}. Bis bald!',
        en: 'Perfect! You can pick up the part at: {location}. See you soon!',
        tr: 'Mükemmel! Parçayı buradan teslim alabilirsiniz: {location}. Yakında görüşürüz!',
        ku: 'Bêkêmasî! Hûn dikarin perçeyê li vir bistînin: {location}. Heta demek din!',
        pl: 'Doskonale! Możesz odebrać część pod adresem: {location}. Do zobaczenia!',
    },

    address_saved: {
        de: 'Vielen Dank! Ihre Lieferadresse wurde gespeichert. Wir versenden das Teil in Kürze.',
        en: 'Thank you! Your delivery address has been saved. We will ship the part shortly.',
        tr: 'Teşekkürler! Teslimat adresiniz kaydedildi. Parçayı kısa sürede göndereceğiz.',
        ku: 'Spas! Navnîşana gihandina we hat tomarkirin. Em ê perçeyê di demek kurt de bişînin.',
        pl: 'Dziękuję! Adres dostawy został zapisany. Część zostanie wkrótce wysłana.',
    },

    address_invalid: {
        de: 'Bitte geben Sie eine gültige Lieferadresse an.',
        en: 'Please provide a valid delivery address.',
        tr: 'Lütfen geçerli bir teslimat adresi girin.',
        ku: 'Ji kerema xwe navnîşanek gihandina derbasdar binivîsin.',
        pl: 'Proszę podać prawidłowy adres dostawy.',
    },

    fresh_start: {
        de: 'Klar! Schicken Sie mir ein Foto vom Fahrzeugschein des neuen Fahrzeugs.',
        en: 'Sure! Send me a photo of the vehicle registration document for the new car.',
        tr: 'Tabii! Yeni araç için ruhsat fotoğrafını gönderin.',
        ku: 'Bê guman! Wêneya belgeya qeydkirina wesayîta nû bişînin.',
        pl: 'Jasne! Wyślij mi zdjęcie dowodu rejestracyjnego nowego pojazdu.',
    },

    follow_up_part: {
        de: 'Ich nutze Ihr {make} {model}. Welches Teil benötigen Sie?',
        en: 'I\'m using your {make} {model}. What part do you need?',
        tr: '{make} {model} aracınızı kullanıyorum. Hangi parçaya ihtiyacınız var?',
        ku: 'Ez {make} {model} we bi kar tînim. Hûn kîjan perçeyê hewce ne?',
        pl: 'Używam Twojego {make} {model}. Jakiej części potrzebujesz?',
    },

    follow_up_fallback: {
        de: 'Welches Teil benötigen Sie für Ihr Fahrzeug?',
        en: 'What part do you need for your vehicle?',
        tr: 'Aracınız için hangi parçaya ihtiyacınız var?',
        ku: 'Hûn ji bo wesayîta xwe kîjan perçeyê hewce ne?',
        pl: 'Jakiej części potrzebujesz do swojego pojazdu?',
    },

    goodbye: {
        de: 'Vielen Dank! Wenn Sie noch etwas brauchen, schreiben Sie mir jederzeit. 👋',
        en: 'Thank you! If you need anything else, just write me anytime. 👋',
        tr: 'Teşekkürler! Başka bir şeye ihtiyacınız olursa, istediğiniz zaman yazın. 👋',
        ku: 'Spas! Heke hûn tiştekî din hewce bikin, her dem ji min re binivîsin. 👋',
        pl: 'Dziękuję! Jeśli potrzebujesz czegoś jeszcze, napisz w dowolnym momencie. 👋',
    },

    order_complete: {
        de: 'Ihre Bestellung ist abgeschlossen. Wenn Sie weitere Fragen haben, fragen Sie einfach!',
        en: 'Your order is complete. If you have further questions, just ask!',
        tr: 'Siparişiniz tamamlandı. Başka sorularınız varsa, sormaktan çekinmeyin!',
        ku: 'Fermana we temam bû. Heke pirsên we yên din hene, tenê bipirsin!',
        pl: 'Zamówienie zostało zrealizowane. Jeśli masz dodatkowe pytania, po prostu zapytaj!',
    },

    delivery_or_pickup_ask: {
        de: 'Bitte entscheiden Sie sich: Lieferung (D) oder Abholung (P)?',
        en: 'Please decide: Delivery (D) or Pickup (P)?',
        tr: 'Lütfen karar verin: Teslimat (D) veya Teslim Alma (P)?',
        ku: 'Ji kerema xwe biryar bidin: Gihandin (D) an Wergirtin (P)?',
        pl: 'Proszę zdecydować: Dostawa (D) czy Odbiór (P)?',
    },

    typing_indicator: {
        de: '...',
        en: '...',
        tr: '...',
        ku: '...',
        pl: '...',
    },

    cancel_order: {
        de: 'Kein Problem! Ihre Anfrage wurde abgebrochen. Wenn Sie etwas anderes brauchen, schreiben Sie mir einfach.',
        en: 'No problem! I\'ve cancelled your request. If you need anything else, just write me.',
        tr: 'Sorun değil! Talebiniz iptal edildi. Başka bir şeye ihtiyacınız olursa yazmanız yeterli.',
        ku: 'Pirsgirêk tune! Daxwaziya we hat betal kirin. Heke tiştekî din hewce be, tenê ji min re binivîsin.',
        pl: 'Nie ma problemu! Zapytanie zostało anulowane. Jeśli potrzebujesz czegoś innego, napisz do mnie.',
    },

    status_multi_ticket: {
        de: 'Zu welcher Anfrage haben Sie die Frage? Bitte nennen Sie die Ticket-ID.',
        en: 'Which request do you have a question about? Please provide the ticket ID.',
        tr: 'Hangi talep hakkında sorunuz var? Lütfen bilet numarasını belirtin.',
        ku: 'Li ser kîjan daxwaziyê pirsa we heye? Ji kerema xwe nasnameya bilêtê binivîsin.',
        pl: 'Którego zapytania dotyczy pytanie? Proszę podać numer zgłoszenia.',
    },

    global_fallback: {
        de: 'Ich arbeite an Ihrer Anfrage. Bitte haben Sie einen Moment Geduld.',
        en: 'I\'m working on your request. Please bear with me for a moment.',
        tr: 'Talebiniz üzerinde çalışıyorum. Lütfen biraz bekleyin.',
        ku: 'Ez li ser daxwaziya we dixebitim. Ji kerema xwe hinekî bisekinin.',
        pl: 'Pracuję nad Twoim zapytaniem. Proszę o chwilę cierpliwości.',
    },

    collect_part_fallback: {
        de: 'Bitte teilen Sie mir mit, welches Teil Sie genau benötigen und falls relevant, für welche Achse/Seite.',
        en: 'Please tell me which exact part you need and, if relevant, for which side/axle.',
        tr: 'Lütfen hangi parçaya ihtiyacınız olduğunu ve gerekiyorsa hangi taraf/aks için olduğunu belirtin.',
        ku: 'Ji kerema xwe ji min re bibêjin ku hûn bi rastî kîjan perçeyê hewce ne û heke têkildar e ji bo kîjan alî/axê.',
        pl: 'Proszę podać dokładnie, jakiej części potrzebujesz i ewentualnie dla której strony/osi.',
    },

    ocr_vin_missing: {
        de: 'Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schicken Sie mir die Nummern oder ein schärferes Foto.',
        en: 'I couldn\'t read VIN or HSN/TSN. Please send those numbers or a clearer photo.',
        tr: 'VIN veya HSN/TSN\'yi okuyamadım. Lütfen numaraları veya daha net bir fotoğraf gönderin.',
        ku: 'Min nekarî VIN an HSN/TSN bixwînim. Ji kerema xwe jimareyan an wêneyek zelaltir bişînin.',
        pl: 'Nie udało się odczytać VIN lub HSN/TSN. Proszę podać numery lub przesłać wyraźniejsze zdjęcie.',
    },

    ocr_photo_failed: {
        de: 'Ich konnte Ihr Fahrzeugschein-Foto nicht laden. Bitte schreiben Sie mir Marke, Modell, Baujahr und VIN/HSN/TSN.',
        en: 'I couldn\'t load your registration photo. Please type your make, model, year, and VIN/HSN/TSN.',
        tr: 'Ruhsat fotoğrafınızı yükleyemedim. Lütfen marka, model, yıl ve VIN/HSN/TSN yazın.',
        ku: 'Min nekarî wêneya belgeya we bar bikim. Ji kerema xwe marka, model, sal û VIN/HSN/TSN binivîsin.',
        pl: 'Nie udało się załadować zdjęcia dowodu rejestracyjnego. Proszę wpisać markę, model, rok i VIN/HSN/TSN.',
    },

    oem_product_found: {
        de: 'Ich habe ein passendes Produkt gefunden und prüfe Angebote.',
        en: 'I found a suitable product and am checking offers now.',
        tr: 'Uygun bir ürün buldum ve teklifleri kontrol ediyorum.',
        ku: 'Min hilberek maqûl dît û niha pêşniyaran kontrol dikim.',
        pl: 'Znalazłem odpowiedni produkt i sprawdzam oferty.',
    },

    oem_product_uncertain: {
        de: 'Ich bin mir beim Produkt nicht sicher. Ich gebe das an einen Kollegen weiter.',
        en: 'I\'m not fully confident about the product yet. I\'ll hand this to a colleague.',
        tr: 'Ürün hakkında tam emin değilim. Bunu bir meslektaşıma ileteceğim.',
        ku: 'Ez li ser hilberê ne bi temamî bawer im. Ez ê vê ji hevkarekî re bişînim.',
        pl: 'Nie jestem w pełni pewien tego produktu. Przekażę to koledze.',
    },

    oem_scrape_failed: {
        de: 'Ich habe ein passendes Produkt, aber die Angebotssuche ist fehlgeschlagen. Ich gebe das an einen Kollegen weiter.',
        en: 'I found a product match but fetching offers failed. I\'ll ask a colleague.',
        tr: 'Uygun bir ürün buldum ama teklifleri getirme başarısız oldu. Bir meslektaşıma soracağım.',
        ku: 'Min hilberek maqûl dît lê anîna pêşniyaran bi ser neket. Ez ê ji hevkarekî bipirsim.',
        pl: 'Znalazłem pasujący produkt, ale pobranie ofert nie powiodło się. Zapytam kolegę.',
    },

    oem_tech_error: {
        de: 'Beim Finden des passenden Teils ist ein technischer Fehler aufgetreten. Ich leite Ihre Anfrage an einen Experten weiter.',
        en: 'A technical error occurred while finding the right part. I\'m forwarding your request to an expert.',
        tr: 'Doğru parçayı bulurken teknik bir hata oluştu. Talebinizi bir uzmana yönlendiriyorum.',
        ku: 'Dema ku perçeya rast dibû çewtiya teknîkî çêbû. Ez daxwaziya we ji pispor re dişînim.',
        pl: 'Wystąpił błąd techniczny podczas szukania odpowiedniej części. Przekazuję zapytanie do eksperta.',
    },

    vehicle_need_more: {
        de: 'Ich brauche noch ein paar Fahrzeugdaten.',
        en: 'I need a bit more vehicle info.',
        tr: 'Biraz daha araç bilgisine ihtiyacım var.',
        ku: 'Hinek agahdariya wesayîtê zêde hewce ye.',
        pl: 'Potrzebuję jeszcze kilku danych pojazdu.',
    },

    vehicle_confirm: {
        de: 'Ich habe Ihr Fahrzeug als {summary} identifiziert. Ist das korrekt?',
        en: 'I\'ve identified your vehicle as {summary}. Is this correct?',
        tr: 'Aracınızı {summary} olarak belirledim. Doğru mu?',
        ku: 'Min wesayîta we wek {summary} nas kir. Ev rast e?',
        pl: 'Zidentyfikowałem Twój pojazd jako {summary}. Czy to poprawne?',
    },

    doc_hint: {
        de: 'Schicken Sie mir am besten zuerst ein Foto Ihres Fahrzeugscheins. Falls nicht möglich: Marke, Modell, Baujahr und VIN oder HSN/TSN.',
        en: 'The best way is to send me a photo of your vehicle registration document. Alternatively: brand, model, year and VIN or HSN/TSN.',
        tr: 'En iyi yol araç ruhsatınızın fotoğrafını göndermek. Alternatif olarak: marka, model, yıl ve VIN veya HSN/TSN.',
        ku: 'Rêya herî baş ev e ku wêneya belgeya qeydkirina wesayîtê bişînin. Alternatîf: marka, model, sal û VIN an HSN/TSN.',
        pl: 'Najlepiej wyślij mi zdjęcie dowodu rejestracyjnego. Alternatywnie: marka, model, rok i VIN lub HSN/TSN.',
    },

    ask_brand: {
        de: 'Welche Automarke ist es?',
        en: 'Which car brand is it?',
        tr: 'Hangi araba markası?',
        ku: 'Kîjan marka otomobîl e?',
        pl: 'Jaka to marka samochodu?',
    },

    ask_model: {
        de: 'Welches Modell genau?',
        en: 'Which exact model is it?',
        tr: 'Tam olarak hangi model?',
        ku: 'Bi rastî kîjan model e?',
        pl: 'Jaki dokładnie model?',
    },

    ask_vin_general: {
        de: 'Bitte teilen Sie mir VIN oder HSN/TSN mit, oder mindestens Marke/Modell/Baujahr, damit ich Ihr Fahrzeug identifizieren kann.',
        en: 'Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car.',
        tr: 'Lütfen VIN veya HSN/TSN paylaşın veya en azından marka/model/yıl bilgisi verin, aracınızı belirleyebileyim.',
        ku: 'Ji kerema xwe VIN an HSN/TSN parve bikin, an herî kêm marka/model/sal, da ku ez karibim wesayîta we nas bikim.',
        pl: 'Proszę podać VIN lub HSN/TSN, lub przynajmniej markę/model/rok, abym mógł zidentyfikować pojazd.',
    },
};

/**
 * Get a translated response string.
 * Falls back to German if the language or key is not found.
 */
export function t(key: ResponseKey, language?: string | null): string {
    const lang = normalizeLang(language);
    return responses[key]?.[lang] ?? responses[key]?.['de'] ?? '';
}

/**
 * Get a response with dynamic values interpolated.
 * Replaces {key} placeholders in the template.
 */
export function tWith(key: ResponseKey, language: string | null, values: Record<string, string | number>): string {
    let text = t(key, language);
    for (const [k, v] of Object.entries(values)) {
        text = text.replace(`{${k}}`, String(v));
    }
    return text;
}

/**
 * Normalize language code to supported 2-letter code.
 */
function normalizeLang(lang?: string | null): SupportedLanguage {
    const l = (lang || 'de').toLowerCase().trim();
    if (l.startsWith('en')) return 'en';
    if (l.startsWith('tr')) return 'tr';
    if (l.startsWith('ku')) return 'ku';
    if (l.startsWith('pl')) return 'pl';
    return 'de';
}

export default { t, tWith };
