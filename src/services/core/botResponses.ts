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
    | 'ocr_success'
    | 'ocr_partial'
    | 'ocr_failed'
    | 'oem_searching'
    | 'oem_found'
    | 'oem_not_found'
    | 'oem_timeout'
    | 'vehicle_incomplete'
    | 'offers_intro'
    | 'no_offers'
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
