// =====================================================================
//  Riconoscere un isolato (giro 41): i caratteri della chiave guidata e le
//  schede dei generi più comuni in un laboratorio di patologia vegetale.
//  La morfologia porta di solito al genere. Per la specie servono il
//  terreno giusto, il microscopio e il sequenziamento dei loci indicati.
//  Bibliografia di base: Leslie & Summerell 2006, The Fusarium Laboratory
//  Manual; Samson et al. 2019, Food and Indoor Fungi 2nd ed.; Pitt &
//  Hocking 2009, Fungi and Food Spoilage 3rd ed.; Watanabe 2010, Pictorial
//  Atlas of Soil and Seed Fungi 3rd ed.; Barnett & Hunter 1998, Illustrated
//  Genera of Imperfect Fungi 4th ed.; Seifert et al. 2011, The Genera of
//  Hyphomycetes; e le monografie citate in ogni scheda.
// =====================================================================

// ---- i caratteri: k è la chiave, multi permette più risposte
export const TRATTI = [
  { k: 'colore', q: 'Colore della colonia, sopra', hint: 'Sulla PDA dopo 7 giorni. Più di uno se è a zone', multi: true, opts: [
    ['bianco', 'Bianco'], ['crema', 'Crema o beige'], ['giallo', 'Giallo'], ['arancio', 'Arancio o salmone'], ['rosa', 'Rosa, rosso o viola'],
    ['verde', 'Verde o blu verde'], ['grigio', 'Grigio'], ['oliva', 'Oliva o marrone'], ['nero', 'Nero']] },
  { k: 'rovescio', q: 'Colore del rovescio', hint: 'Girando la piastra', opts: [
    ['chiaro', 'Incolore o crema'], ['giallo', 'Giallo o arancio'], ['rosso', 'Rosso, viola o porpora'], ['marrone', 'Marrone'], ['nero', 'Nero o quasi']] },
  { k: 'aspetto', q: 'Aspetto del micelio', opts: [
    ['cotonoso', 'Cotonoso, alto'], ['vellutato', 'Vellutato o polveroso'], ['feltroso', 'Feltroso, basso e compatto'], ['mucoso', 'Lucido e umido, da lievito'], ['zone', 'Ad anelli o a petali']] },
  { k: 'crescita', q: 'Crescita in 7 giorni a 25 °C', hint: 'Diametro della colonia su una piastra da 9 cm', opts: [
    ['lenta', 'Lenta, meno di 3 cm'], ['media', 'Media, da 3 a 7 cm'], ['rapida', 'Rapida, riempie la piastra']] },
  { k: 'strutture', q: 'Cosa si vede a occhio o allo stereo', multi: true, opts: [
    ['nessuna', 'Niente di particolare'], ['sclerozi', 'Sclerozi, corpi duri scuri'], ['puntini', 'Puntini neri, picnidi o sporodochi'], ['arancio', 'Masse o cuscinetti arancio'],
    ['sporangi', 'Testine scure su fili lunghi'], ['pustole', 'Ciuffi o anelli di spore verdi'], ['gocce', 'Goccioline di essudato']] },
  { k: 'spore', q: 'Spore al microscopio', hint: 'A 400×, montate in acqua o in blu cotone', multi: true, opts: [
    ['falcate', 'Falcate con setti, a canoa'], ['lunate', 'A mezzaluna, senza piede'], ['catene', 'Tonde e piccole, in lunghe catene'], ['rami', 'Ellittiche in catene ramificate'],
    ['muribecco', 'Muriformi a clava, con becco'], ['muri', 'Muriformi senza becco'], ['elmintosporio', 'Cilindriche scure, con molti setti'], ['cilindriche', 'Cilindriche chiare, una cellula'],
    ['grappolo', 'Ovali, a grappolo su rami scuri'], ['teste', 'Piccole, in testine mucose'], ['grandinere', 'Tonde nere, grandi, una cellula'], ['verrucose', 'Tonde scure e verrucose'],
    ['diplodia', 'Grandi ellittiche, chiare poi brune'], ['picnidiospore', 'Piccolissime, escono dai picnidi'], ['limoni', 'A limone, in catenelle'], ['sporangi', 'Dentro sacche (sporangi)'],
    ['oomiceti', 'Sporangi a limone e oospore'], ['gemme', 'Cellule singole che gemmano'], ['nessuna', 'Nessuna spora']] },
  { k: 'colorespore', q: 'Colore delle spore', opts: [
    ['ialine', 'Trasparenti'], ['verdi', 'Verdi in massa'], ['brune', 'Brune o oliva'], ['nere', 'Nere'], ['arancio', 'Rosa o arancio in massa']] },
  { k: 'ife', q: 'Ife', opts: [
    ['settate', 'Chiare, con setti'], ['scure', 'Scure, con setti'], ['cenocitiche', 'Larghe, quasi senza setti'], ['angolo', 'Rami ad angolo retto, strozzati'], ['fibbie', 'Con giunti a fibbia']] },
];

// ---- le schede. w: per ogni carattere i valori tipici, poi dopo la barra quelli possibili
//      gen: i nomi di genere con cui si cercano i ceppi della micoteca
export const FUNGHI = [
  {
    g: 'Fusarium', fam: 'Nectriaceae, ifomicete', gen: ['Fusarium', 'Gibberella'], spora: 'falcate',
    w: { colore: 'bianco rosa | arancio giallo crema', rovescio: 'rosso giallo | chiaro marrone', aspetto: 'cotonoso | feltroso vellutato', crescita: 'rapida | media',
      strutture: 'arancio | nessuna gocce sclerozi', spore: 'falcate | teste catene', colorespore: 'ialine | arancio', ife: 'settate' },
    pda: 'Crescita rapida, in genere da 4 a 8 cm in 7 giorni a 25 °C. Micelio aereo abbondante e cotonoso, bianco, rosa, salmone o viola. Il rovescio aiuta, rosso carminio in F. graminearum, rosso bruno in F. culmorum, viola in molti F. oxysporum, giallo o crema in altre specie. Con l\'età compaiono sporodochi arancio.',
    altri: 'Su CLA (agar con foglie di garofano) e su SNA, a luce alternata, si formano gli sporodochi con i macroconidi tipici, che sulla PDA mancano o sono deformati. La forma dei macroconidi si guarda sul CLA, il pigmento sulla PDA.',
    micro: 'Macroconidi falcati, a canoa, con 3 a 7 setti, cellula basale a piede e cellula apicale più o meno appuntita, di solito 25 a 60 × 3,5 a 6 µm. Microconidi ovali o reniformi, con 0 o 1 setto, in false teste o in catenelle, su monofialidi o polifialidi. Mancano in F. graminearum e F. culmorum. Clamidospore in alcune specie.',
    confusione: 'Microdochium (conidi a mezzaluna senza piede, colonia salmone, cresce anche al freddo), Cylindrocarpon e Ilyonectria (macroconidi diritti con le estremità arrotondate), Colletotrichum (conidi diritti di una cellula).',
    lab: 'Sul grano le specie più frequenti sono F. graminearum, F. culmorum, F. poae, F. avenaceum e F. langsethiae. Producono tricoteceni (DON, NIV, T-2 e HT-2), zearalenone, enniatine e moniliformina. Le fumonisine vengono soprattutto da F. verticillioides e F. proliferatum su mais.',
    loci: 'TEF1-α è il locus di riferimento, con RPB1 e RPB2 per le specie vicine. L\'ITS non separa le specie. Le sequenze si confrontano su FUSARIUM-ID e Fusarioid-ID.',
    specie: [
      ['F. graminearum', 'Crescita molto rapida, micelio da bianco a rosa, rovescio rosso carminio. Macroconidi slanciati, appena curvi, con 5 o 6 setti, niente microconidi. DON o NIV e zearalenone, fusariosi della spiga.'],
      ['F. culmorum', 'Rapido, micelio da rosso bruno a giallo ocra, rovescio rosso scuro. Macroconidi corti e tozzi con 3 a 5 setti, niente microconidi. DON o NIV e zearalenone, spiga e colletto.'],
      ['F. pseudograminearum', 'Quasi uguale a F. graminearum al microscopio, dà soprattutto il marciume del colletto. Si separa con TEF1-α.'],
      ['F. poae', 'Colonie polverose, bianche o rosa, rovescio giallo o rosso, odore fruttato. Microconidi globosi o a pera, molto abbondanti, macroconidi rari. NIV e DAS.'],
      ['F. langsethiae', 'Simile a F. poae ma più lento e senza odore, colonie polverose bianche o lilla. Microconidi a goccia su polifialidi. T-2 e HT-2.'],
      ['F. avenaceum', 'Micelio bianco o giallo pallido, rovescio da giallo a rosso bruno. Macroconidi lunghi e sottili, quasi aghiformi, con 4 a 7 setti. Enniatine e moniliformina.'],
      ['F. verticillioides e F. proliferatum', 'Microconidi a clava in lunghe catene, da monofialidi in F. verticillioides e da polifialidi in F. proliferatum. Colonie bianche o viola. Fumonisine, soprattutto su mais.'],
    ],
    refs: ['Leslie & Summerell 2006, The Fusarium Laboratory Manual, Blackwell', 'Crous et al. 2021, Studies in Mycology 98, 100116', 'Torres-Cruz et al. 2022, Plant Disease 106, 1610-1616 (FUSARIUM-ID v.3.0)'],
  },
  {
    g: 'Microdochium', fam: 'Microdochiaceae, ifomicete', gen: ['Microdochium', 'Monographella'], spora: 'lunate',
    w: { colore: 'bianco arancio | rosa crema', rovescio: 'giallo | chiaro rosso', aspetto: 'feltroso | cotonoso mucoso', crescita: 'media | lenta',
      strutture: 'arancio | nessuna', spore: 'lunate | falcate', colorespore: 'ialine | arancio', ife: 'settate' },
    pda: 'Crescita media, micelio rado e basso, da bianco a salmone o pesca, rovescio pesca o arancio. Cresce bene anche a 5 a 15 °C, quando Fusarium rallenta.',
    altri: 'Su PDA e SNA a luce alternata forma sporodochi arancio con masse di conidi.',
    micro: 'Conidi a mezzaluna o fusiformi curvi, senza cellula a piede, con 0 a 3 setti, circa 10 a 30 × 2,5 a 5 µm, prodotti da cellule conidiogene con dentini o anelli.',
    confusione: 'Fusarium, da cui si distingue per l\'assenza della cellula a piede e per i conidi più corti e con meno setti.',
    lab: 'M. nivale e M. majus danno la muffa delle nevi e marciumi del piede e della spiga del grano. Non producono tricoteceni.',
    loci: 'RPB2 e TUB2 separano M. nivale da M. majus, l\'ITS arriva al genere.',
    refs: ['Hernández-Restrepo et al. 2016, Persoonia 36, 57-82', 'Glynn et al. 2005, Mycological Research 109, 872-880'],
  },
  {
    g: 'Aspergillus', fam: 'Aspergillaceae, ifomicete', gen: ['Aspergillus', 'Eurotium'], spora: 'catene',
    w: { colore: 'verde nero giallo | bianco oliva crema', rovescio: 'chiaro giallo | marrone rosso', aspetto: 'vellutato | feltroso', crescita: 'rapida media | lenta',
      strutture: 'nessuna | gocce sclerozi', spore: 'catene', colorespore: 'verdi nere | ialine brune arancio', ife: 'settate' },
    pda: 'Colonie piatte, vellutate o polverose, con il colore dato dalle spore. Giallo verde in A. flavus, blu verde o grigio verde in A. fumigatus, nero in A. niger e A. carbonarius, ocra in A. ochraceus e A. westerdijkiae, cannella in A. terreus. Rovescio chiaro o giallo.',
    altri: 'Per l\'identificazione si usano CYA, MEA e YES a 25 °C, e CYA a 37 °C. AFPA per gli aflatossigeni, che fanno il rovescio arancio.',
    micro: 'Conidioforo non ramificato che termina in una vescicola rigonfia coperta di fialidi, su una fila (uniseriate) o su metule (biseriate). Conidi globosi o subglobosi, 2 a 5 µm, lisci o ruvidi, in catene secche.',
    confusione: 'Penicillium, che ha il pennello ramificato senza vescicola. Le colonie verdi giovani si somigliano molto.',
    lab: 'Aflatossine (A. flavus, A. parasiticus), ocratossina A (A. carbonarius, A. niger, A. ochraceus, A. westerdijkiae, A. steynii), fumonisina B2 (A. niger). A. fumigatus e A. flavus sono allergizzanti e patogeni opportunisti, le piastre che sporulano si aprono sotto cappa.',
    loci: 'Calmodulina (CaM) e β-tubulina (BenA) per la specie, l\'ITS arriva alla sezione.',
    refs: ['Samson et al. 2014, Studies in Mycology 78, 141-173', 'Samson et al. 2019, Food and Indoor Fungi 2nd ed., Westerdijk'],
  },
  {
    g: 'Penicillium', fam: 'Aspergillaceae, ifomicete', gen: ['Penicillium', 'Talaromyces'], spora: 'catene',
    w: { colore: 'verde | bianco grigio giallo', rovescio: 'chiaro giallo | marrone rosso', aspetto: 'vellutato | feltroso cotonoso zone', crescita: 'media lenta | rapida',
      strutture: 'nessuna gocce', spore: 'catene', colorespore: 'verdi | ialine', ife: 'settate' },
    pda: 'Colonie vellutate o fioccose, spesso solcate a raggiera, blu verdi, grigio verdi o verde opaco, con il margine bianco. Crescita di solito più lenta di Aspergillus. Rovescio da chiaro a giallo, arancio o rosso bruno, spesso con goccioline di essudato.',
    altri: 'CYA, MEA, YES e CREA a 25 °C, CYA a 30 e 37 °C. Talaromyces fa spesso colonie gialle o rosse con pigmenti diffusibili.',
    micro: 'Conidioforo a pennello (penicillo) con rami, metule e fialidi, senza vescicola. Conidi globosi o ellittici, 2 a 4 µm, in lunghe catene.',
    confusione: 'Aspergillus (testa con vescicola), Paecilomyces (fialidi lunghe e divergenti, colonie giallo brune), Trichoderma (molto più rapido, fialidi a fiasco).',
    lab: 'Patulina (P. expansum, marciume blu delle pomacee), ocratossina A (P. verrucosum sui cereali, P. nordicum), citrinina. Contaminante frequente di piastre e semi.',
    loci: 'β-tubulina (BenA) e calmodulina (CaM), con RPB2. L\'ITS arriva al genere.',
    refs: ['Visagie et al. 2014, Studies in Mycology 78, 343-371', 'Pitt & Hocking 2009, Fungi and Food Spoilage 3rd ed., Springer'],
  },
  {
    g: 'Alternaria', fam: 'Pleosporaceae, ifomicete scuro', gen: ['Alternaria'], spora: 'muribecco',
    w: { colore: 'oliva grigio nero | bianco', rovescio: 'nero marrone', aspetto: 'cotonoso vellutato | feltroso zone', crescita: 'rapida media',
      strutture: 'nessuna', spore: 'muribecco | muri', colorespore: 'brune', ife: 'scure | settate' },
    pda: 'Crescita da media a rapida, micelio da grigio a oliva scuro, cotonoso o vellutato, rovescio nero o marrone scuro. Sulla PDA sporula poco.',
    altri: 'Sporula bene su PCA (patata e carota) o V8 a luce alternata (NUV, 8 ore di luce e 16 di buio) a 22 °C. Le catene si guardano su PCA dopo 7 giorni, senza montare il vetrino, a basso ingrandimento.',
    micro: 'Conidi obclavati o ellittici, bruni, muriformi (setti trasversali e longitudinali), con un becco apicale, in catene semplici o ramificate. A. alternata 20 a 60 × 9 a 18 µm in catene ramificate, A. solani e le specie a spore grandi singole con becco lungo.',
    confusione: 'Stemphylium (conidi senza becco, singoli, strozzati al setto centrale), Ulocladium (conidi obovati senza becco), Epicoccum (spore tonde verrucose su sporodochi).',
    lab: 'Alternariolo (AOH), alternariolo monometiletere (AME), acido tenuazonico (TeA), tentossina e altenuene. Punta nera del grano, macchie fogliari, marciumi di frutti e ortaggi.',
    loci: 'ITS e GAPDH per la sezione, poi RPB2, TEF1, Alt a 1 ed endoPG. Le specie a spore piccole della sezione Alternaria non si separano bene neanche con i loci.',
    refs: ['Simmons 2007, Alternaria: An Identification Manual, CBS', 'Woudenberg et al. 2013, Studies in Mycology 75, 171-212'],
  },
  {
    g: 'Stemphylium', fam: 'Pleosporaceae, ifomicete scuro', gen: ['Stemphylium', 'Pleospora'], spora: 'muri',
    w: { colore: 'oliva grigio | nero bianco', rovescio: 'marrone nero', aspetto: 'cotonoso vellutato | feltroso', crescita: 'media rapida',
      strutture: 'nessuna | puntini', spore: 'muri | muribecco', colorespore: 'brune', ife: 'scure | settate' },
    pda: 'Colonie da grigio bruno a oliva scuro, cotonose, rovescio marrone o nero. Crescita media.',
    altri: 'Sporula su V8 o PCA a luce alternata. Su paglia sterile può formare gli pseudoteci di Pleospora.',
    micro: 'Conidi singoli, oblunghi o subglobosi, muriformi, bruni e spesso verrucosi, senza becco, strozzati al setto centrale, circa 20 a 35 × 12 a 25 µm. Il conidioforo ha la cellula apicale rigonfia e ricresce attraverso la cicatrice (percorrente).',
    confusione: 'Alternaria, che ha conidi con becco, più spesso in catena, e conidiofori senza la cellula apicale rigonfia.',
    lab: 'Maculature fogliari di pomodoro, aglio, asparago, erba medica e pero. A volte isolato dai semi di grano.',
    loci: 'ITS, GAPDH e CaM.',
    refs: ['Simmons 1969, Mycologia 61, 1-26', 'Woudenberg et al. 2017, Studies in Mycology 87, 77-103'],
  },
  {
    g: 'Cladosporium', fam: 'Cladosporiaceae, ifomicete scuro', gen: ['Cladosporium'], spora: 'rami',
    w: { colore: 'oliva verde | grigio nero', rovescio: 'nero | marrone', aspetto: 'vellutato | feltroso', crescita: 'lenta media',
      strutture: 'nessuna', spore: 'rami', colorespore: 'brune | verdi', ife: 'scure | settate' },
    pda: 'Crescita lenta o media, colonie vellutate, verde oliva o bruno oliva, spesso un po\' rilevate, rovescio da oliva scuro a nero.',
    altri: 'MEA, OA e SNA per la forma dei conidi e dei conidiofori.',
    micro: 'Conidi piccoli, ellittici o a limone, chiari o bruno oliva, in catene ramificate che si staccano facilmente. Le cicatrici di attacco (ili) sono scure e ispessite. Alla base delle catene ci sono conidi più lunghi con uno o più setti (ramoconidi).',
    confusione: 'Penicillium quando la colonia è verde, ma Cladosporium ha ife scure e catene ramificate senza pennello. Cladophialophora e altri lieviti neri.',
    lab: 'Tra i funghi più comuni sulle foglie, sui semi e nell\'aria del laboratorio. Spesso è un contaminante. C. fulvum (oggi Fulvia fulva) dà la cladosporiosi del pomodoro.',
    loci: 'TEF1-α e actina (ACT), l\'ITS arriva al complesso di specie.',
    refs: ['Bensch et al. 2012, Studies in Mycology 72, 1-401'],
  },
  {
    g: 'Trichoderma', fam: 'Hypocreaceae, ifomicete', gen: ['Trichoderma', 'Hypocrea'], spora: 'teste',
    w: { colore: 'verde bianco | giallo', rovescio: 'chiaro giallo', aspetto: 'zone cotonoso | vellutato', crescita: 'rapida',
      strutture: 'pustole | nessuna', spore: 'teste', colorespore: 'verdi | ialine', ife: 'settate' },
    pda: 'Crescita molto rapida, riempie la piastra in 3 o 4 giorni. Micelio prima bianco e rado, poi ciuffi o anelli concentrici di spore da giallo verdi a verde scuro. Rovescio chiaro o giallo. Alcune specie hanno odore di cocco.',
    altri: 'PDA e SNA a 25 °C, la crescita a 30 e 35 °C aiuta a separare le specie.',
    micro: 'Conidiofori molto ramificati, a piramide, con fialidi a fiasco in gruppi di 2 a 4. Conidi piccoli, globosi o ellittici, verdi, 2,5 a 4,5 µm, in testine mucose.',
    confusione: 'Gliocladium e Clonostachys (conidiofori a pennello, colonie bianche o salmone), Penicillium (più lento, catene secche).',
    lab: 'Antagonisti usati in difesa biologica, come T. harzianum, T. atroviride e T. virens. Invade in fretta le piastre degli altri funghi, va tenuto separato.',
    loci: 'TEF1-α e RPB2, l\'ITS solo per il genere.',
    refs: ['Cai & Druzhinina 2021, Fungal Diversity 107, 1-69', 'Samuels 2006, Phytopathology 96, 195-206'],
  },
  {
    g: 'Botrytis', fam: 'Sclerotiniaceae, ifomicete', gen: ['Botrytis', 'Botryotinia'], spora: 'grappolo',
    w: { colore: 'grigio | bianco oliva', rovescio: 'chiaro marrone | nero', aspetto: 'vellutato cotonoso', crescita: 'rapida | media',
      strutture: 'sclerozi | nessuna', spore: 'grappolo', colorespore: 'ialine brune', ife: 'settate | scure' },
    pda: 'Crescita rapida, micelio prima bianco poi grigio o grigio bruno, polveroso quando sporula. Sclerozi neri e appiattiti, spesso ad anello o al bordo della piastra. Rovescio chiaro o brunastro.',
    altri: 'Sporula meglio a luce alternata e a 18 a 22 °C.',
    micro: 'Conidiofori lunghi, scuri, ramificati in alto, con le cellule terminali rigonfie e coperte di dentini. Conidi ovali, da ialini a bruno chiari, 8 a 14 × 6 a 9 µm, a grappolo.',
    confusione: 'Sclerotinia (sclerozi più grandi e niente conidi), Monilinia (conidi in catenelle a limone).',
    lab: 'B. cinerea, la muffa grigia, attacca vite, fragola, pomodoro e moltissime altre piante. Resiste in fretta ai fungicidi.',
    loci: 'G3PDH, HSP60 e RPB2, l\'ITS non separa le specie.',
    refs: ['Elad et al. 2016, Botrytis: the Fungus, the Pathogen and its Management, Springer', 'Staats et al. 2005, Molecular Biology and Evolution 22, 333-346'],
  },
  {
    g: 'Sclerotinia', fam: 'Sclerotiniaceae, solo micelio in coltura', gen: ['Sclerotinia'], spora: 'nessuna',
    w: { colore: 'bianco | crema', rovescio: 'chiaro | marrone', aspetto: 'cotonoso', crescita: 'rapida',
      strutture: 'sclerozi | gocce', spore: 'nessuna', colorespore: '', ife: 'settate' },
    pda: 'Crescita rapidissima, micelio bianco e cotonoso che riempie la piastra in 3 o 4 giorni. Dopo 5 a 10 giorni forma sclerozi neri, grandi alcuni millimetri, spesso con goccioline. Rovescio chiaro.',
    altri: 'Sulla PDA gli sclerozi si formano bene a 20 °C. Gli apoteci si ottengono solo con un trattamento al freddo degli sclerozi.',
    micro: 'Ife ialine con setti, nessun conidio. A volte microconidi piccolissimi in catenelle, che non germinano.',
    confusione: 'Botrytis (ha conidi e sclerozi più piccoli e piatti), Athelia rolfsii (sclerozi tondi piccoli come semi di senape, ife con giunti a fibbia).',
    lab: 'S. sclerotiorum dà il marciume bianco di girasole, colza, soia, lattuga e moltissime orticole.',
    loci: 'ITS per il genere, con G3PDH, HSP60 e RPB2 per le specie vicine.',
    refs: ['Kohn 1979, Phytopathology 69, 881-886', 'Willetts & Wong 1980, The Botanical Review 46, 101-165'],
  },
  {
    g: 'Rhizoctonia', fam: 'Ceratobasidiaceae, basidiomicete senza spore', gen: ['Rhizoctonia', 'Thanatephorus', 'Ceratobasidium'], spora: 'nessuna',
    w: { colore: 'oliva | bianco crema', rovescio: 'marrone | chiaro', aspetto: 'feltroso cotonoso | zone', crescita: 'rapida',
      strutture: 'sclerozi | nessuna', spore: 'nessuna', colorespore: '', ife: 'angolo | settate scure' },
    pda: 'Crescita rapida, micelio prima chiaro poi bruno chiaro o marrone, spesso a zone. Sclerozi bruni irregolari, poco compatti, che si uniscono in croste.',
    altri: 'Su acqua agar si vedono bene le ramificazioni. I gruppi di anastomosi (AG) si determinano con l\'appaiamento su vetrino con isolati di riferimento.',
    micro: 'Ife larghe 6 a 10 µm, brunastre, ramificate quasi ad angolo retto, con una strozzatura e un setto vicino all\'inizio del ramo. Cellule a barilotto (monilioidi). Nessuna spora. In R. solani le cellule hanno più nuclei.',
    confusione: 'Altri funghi senza spore, come Sclerotinia (micelio bianco e sclerozi neri compatti) e i basidiomiceti del legno (giunti a fibbia).',
    lab: 'R. solani causa marciumi del colletto e delle radici, cancro dei germogli della patata e moria delle piantine.',
    loci: 'ITS, che distingue anche i gruppi di anastomosi.',
    refs: ['Sneh, Burpee & Ogoshi 1991, Identification of Rhizoctonia Species, APS Press', 'Sharon et al. 2008, Mycoscience 49, 93-114'],
  },
  {
    g: 'Colletotrichum', fam: 'Glomerellaceae, celomicete', gen: ['Colletotrichum', 'Glomerella'], spora: 'cilindriche',
    w: { colore: 'grigio bianco | oliva arancio nero', rovescio: 'chiaro marrone | nero rosso giallo', aspetto: 'cotonoso feltroso | zone', crescita: 'media rapida',
      strutture: 'arancio | puntini sclerozi', spore: 'cilindriche | falcate', colorespore: 'ialine arancio', ife: 'settate' },
    pda: 'Crescita media o rapida, micelio da bianco a grigio o grigio oliva, spesso con masse di conidi arancio o salmone sulle fruttificazioni (acervuli). Rovescio grigio o scuro, a volte rosa nel complesso acutatum.',
    altri: 'PDA e SNA con pezzetti di stelo di anice o di foglia sterilizzati, a luce alternata, per i conidiomi e le setole. Gli appressori si vedono in coltura su vetrino.',
    micro: 'Conidi ialini, di una cellula, cilindrici con le estremità arrotondate (complesso gloeosporioides), fusiformi con un\'estremità appuntita (complesso acutatum) o falcati (graminicola, truncatum), circa 10 a 20 × 3 a 6 µm. Setole scure negli acervuli. Appressori bruni, lobati.',
    confusione: 'Fusarium (conidi con setti e cellula a piede), Pestalotiopsis (conidi con setti e appendici).',
    lab: 'Antracnosi di olivo, agrumi, fragola, fagiolo e molte altre piante, marciumi dei frutti in post raccolta.',
    loci: 'ITS e GAPDH per il complesso, poi ACT, CHS-1, TUB2 e HIS3. Per gloeosporioides anche ApMat e GS.',
    refs: ['Cannon et al. 2012, Studies in Mycology 73, 181-213', 'Weir et al. 2012, Studies in Mycology 73, 115-180', 'Damm et al. 2012, Studies in Mycology 73, 37-113'],
  },
  {
    g: 'Phoma e Didymella', fam: 'Didymellaceae, celomicete', gen: ['Phoma', 'Didymella', 'Boeremia', 'Stagonosporopsis', 'Ascochyta', 'Neoascochyta'], spora: 'picnidiospore',
    w: { colore: 'oliva grigio | bianco rosa nero', rovescio: 'marrone nero | chiaro rosso giallo', aspetto: 'feltroso vellutato | cotonoso', crescita: 'media | lenta rapida',
      strutture: 'puntini', spore: 'picnidiospore', colorespore: 'ialine | arancio', ife: 'settate' },
    pda: 'Crescita media, colonie oliva, grigie o brune, feltrose, con picnidi neri immersi o in superficie che a volte emettono cirri crema o rosa. Rovescio bruno o nero.',
    altri: 'OA (avena) e MEA per i picnidi e il pigmento. La prova con NaOH su OA (una goccia sul bordo della colonia) fa diventare rosso o blu il pigmento di alcune specie.',
    micro: 'Picnidi globosi, scuri, con un ostiolo. Conidi piccolissimi, ialini, di una cellula, ellittici o cilindrici, circa 3 a 8 × 1,5 a 3 µm. Clamidospore in alcune specie.',
    confusione: 'Altri celomiceti con picnidi, come Septoria e Stagonospora (conidi lunghi con setti) e Botryosphaeriaceae (conidi molto più grandi).',
    lab: 'Didymella e Ascochyta danno l\'antracnosi delle leguminose, Boeremia e Stagonosporopsis marciumi e cancri. Si isolano spesso dai semi.',
    loci: 'ITS e LSU per il genere, poi RPB2 e TUB2.',
    refs: ['Boerema et al. 2004, Phoma Identification Manual, CABI', 'Chen et al. 2015, Studies in Mycology 82, 137-217'],
  },
  {
    g: 'Botryosphaeriaceae', fam: 'Diplodia, Lasiodiplodia, Neofusicoccum, celomiceti', gen: ['Diplodia', 'Lasiodiplodia', 'Neofusicoccum', 'Botryosphaeria', 'Dothiorella', 'Macrophomina'], spora: 'diplodia',
    w: { colore: 'grigio nero oliva | bianco', rovescio: 'nero | marrone', aspetto: 'cotonoso', crescita: 'rapida',
      strutture: 'puntini | nessuna sclerozi', spore: 'diplodia', colorespore: 'ialine brune', ife: 'settate scure' },
    pda: 'Crescita molto rapida, riempie la piastra in 2 a 4 giorni. Micelio aereo denso, prima bianco poi grigio, oliva e nero, rovescio nero.',
    altri: 'I picnidi si formano su aghi di pino sterili appoggiati su acqua agar, a luce alternata, in 2 o 3 settimane. Macrophomina fa microsclerozi neri sulla PDA.',
    micro: 'Diplodia, conidi grandi, ellittici o ovali, prima ialini poi bruni, con 0 o 1 setto e parete spessa, circa 20 a 30 × 10 a 15 µm. Lasiodiplodia, conidi bruni con striature e parafisi. Neofusicoccum, conidi ialini fusiformi di una cellula, circa 15 a 25 × 5 a 7 µm.',
    confusione: 'Altri celomiceti (Phoma ha conidi molto più piccoli), le colonie giovani somigliano a Nigrospora.',
    lab: 'Mal dell\'esca e cancri della vite, cancri di olivo, quercia, pino e fruttiferi, marciumi dei frutti. Spesso endofiti latenti.',
    loci: 'ITS con TEF1-α, poi TUB2 e RPB2.',
    refs: ['Phillips et al. 2013, Studies in Mycology 76, 51-167'],
  },
  {
    g: 'Epicoccum', fam: 'Didymellaceae, ifomicete', gen: ['Epicoccum'], spora: 'verrucose',
    w: { colore: 'giallo arancio | rosa oliva bianco', rovescio: 'rosso giallo | marrone', aspetto: 'cotonoso | feltroso', crescita: 'rapida media',
      strutture: 'puntini', spore: 'verrucose', colorespore: 'brune nere', ife: 'settate' },
    pda: 'Crescita rapida, micelio cotonoso da giallo arancio a bruno rossiccio, con pigmenti gialli, arancio o rossi che si diffondono nel terreno. Sporodochi neri come puntini.',
    altri: 'Sporula meglio su OA e PCA a luce alternata.',
    micro: 'Conidi globosi o a pera, bruno scuri, verrucosi, muriformi, 15 a 25 µm, su sporodochi a cuscinetto. Spesso resta attaccato un pezzetto della cellula che li porta.',
    confusione: 'Alternaria (conidi a clava con becco), Phoma (picnidi e conidi piccolissimi).',
    lab: 'E. nigrum è comunissimo su foglie, semi e cariossidi di grano, dove contribuisce alla punta nera. Viene studiato come antagonista.',
    loci: 'ITS, LSU, RPB2 e TUB2.',
    refs: ['Chen et al. 2015, Studies in Mycology 82, 137-217', 'Watanabe 2010, Pictorial Atlas of Soil and Seed Fungi 3rd ed., CRC'],
  },
  {
    g: 'Nigrospora', fam: 'Apiosporaceae, ifomicete', gen: ['Nigrospora', 'Khuskia'], spora: 'grandinere',
    w: { colore: 'grigio nero bianco', rovescio: 'nero marrone', aspetto: 'cotonoso', crescita: 'rapida',
      strutture: 'puntini | nessuna', spore: 'grandinere', colorespore: 'nere', ife: 'settate | scure' },
    pda: 'Crescita rapida, micelio lanoso prima bianco poi grigio e nero, rovescio nero. Le spore nere si vedono come puntini nel micelio aereo.',
    altri: 'PDA e OA, sporula a luce alternata.',
    micro: 'Conidi neri, lisci, di una cellula, globosi o un po\' schiacciati, 10 a 20 µm, singoli su una cellula rigonfia e chiara a forma di fiasco.',
    confusione: 'Botryosphaeriaceae (colonie simili ma conidi ellittici dai picnidi), Arthrinium (conidi più piccoli e lenticolari).',
    lab: 'Si isola spesso da cariossidi e foglie di grano, riso e mais, di solito come endofita o saprofita.',
    loci: 'ITS, TEF1-α e TUB2.',
    refs: ['Wang et al. 2017, Persoonia 39, 118-142'],
  },
  {
    g: 'Bipolaris e Drechslera', fam: 'Pleosporaceae, elmintosporioidi', gen: ['Bipolaris', 'Drechslera', 'Pyrenophora', 'Cochliobolus', 'Curvularia', 'Exserohilum'], spora: 'elmintosporio',
    w: { colore: 'oliva grigio nero', rovescio: 'nero marrone', aspetto: 'vellutato cotonoso | feltroso', crescita: 'media rapida',
      strutture: 'nessuna | puntini', spore: 'elmintosporio', colorespore: 'brune', ife: 'scure | settate' },
    pda: 'Colonie da grigio a oliva scuro o nere, vellutate o lanose, rovescio nero. Crescita media.',
    altri: 'V8 o PDA a luce alternata (NUV). Pyrenophora tritici-repentis sporula solo con un passaggio luce e buio.',
    micro: 'Conidi grandi, bruni, cilindrici o a clava, diritti o curvi, con molti pseudosetti (distosetti), 30 a 120 µm. In Bipolaris germinano dalle due estremità, in Drechslera da qualunque cellula. Curvularia ha conidi curvi con una cellula centrale più grande e scura.',
    confusione: 'Alternaria (conidi muriformi con setti anche longitudinali).',
    lab: 'B. sorokiniana dà il marciume comune delle radici e la punta nera del grano, P. tritici-repentis la maculatura gialla (tan spot), D. teres la striatura dell\'orzo.',
    loci: 'ITS e GAPDH, poi TEF1-α.',
    refs: ['Manamgoda et al. 2014, Studies in Mycology 79, 221-288', 'Ellis 1971, Dematiaceous Hyphomycetes, CMI'],
  },
  {
    g: 'Verticillium', fam: 'Plectosphaerellaceae, ifomicete', gen: ['Verticillium'], spora: 'teste',
    w: { colore: 'bianco crema | nero', rovescio: 'nero chiaro', aspetto: 'feltroso cotonoso | vellutato', crescita: 'lenta media',
      strutture: 'sclerozi | puntini nessuna', spore: 'teste', colorespore: 'ialine', ife: 'settate | scure' },
    pda: 'Crescita lenta o media, micelio bianco o crema, che al centro diventa nero per i microsclerozi in V. dahliae o per il micelio scuro in V. albo-atrum. Rovescio con zone nere.',
    altri: 'PDA e agar all\'etanolo, che favorisce i microsclerozi. Agar d\'acqua per vedere i verticilli.',
    micro: 'Conidiofori con le fialidi a verticillo, cioè a raggiera a più livelli. Conidi ialini, ovali, di una cellula, 3 a 7 µm, in testine mucose. Microsclerozi bruni fatti di cellule gonfie.',
    confusione: 'Acremonium e Sarocladium (fialidi singole, non a verticillo), Fusarium nelle colonie giovani.',
    lab: 'V. dahliae causa la verticilliosi di olivo, pomodoro, melanzana, carciofo e cotone. I microsclerozi restano vitali nel suolo per anni.',
    loci: 'ITS, poi ACT, EF e GPD per separare le specie.',
    refs: ['Inderbitzin et al. 2011, PLoS ONE 6, e28341'],
  },
  {
    g: 'Rhizopus', fam: 'Mucorales', gen: ['Rhizopus'], spora: 'sporangi',
    w: { colore: 'grigio bianco | nero', rovescio: 'chiaro', aspetto: 'cotonoso', crescita: 'rapida',
      strutture: 'sporangi', spore: 'sporangi', colorespore: 'nere brune', ife: 'cenocitiche' },
    pda: 'Crescita rapidissima, riempie la piastra in 2 giorni e solleva il coperchio. Micelio alto, grigio bianco, con testine nere come spilli. Rovescio chiaro.',
    altri: 'Cresce su qualunque terreno. Per contenerlo si usano piastre con poco terreno o si tiene lontano dalle altre colture.',
    micro: 'Ife larghe quasi senza setti. Stoloni e rizoidi alla base di sporangiofori riuniti in ciuffi. Sporangi neri, globosi, con columella, sporangiospore brune e striate.',
    confusione: 'Mucor (niente rizoidi e stoloni, sporangi grigi o bruni), Absidia (rizoidi tra gli sporangiofori).',
    lab: 'R. stolonifer causa il marciume molle di fragole, patate dolci e altri frutti dopo la raccolta. Contaminante che invade le piastre.',
    loci: 'ITS.',
    refs: ['Walther et al. 2013, Persoonia 30, 11-47', 'Samson et al. 2019, Food and Indoor Fungi 2nd ed., Westerdijk'],
  },
  {
    g: 'Mucor', fam: 'Mucorales', gen: ['Mucor', 'Absidia', 'Lichtheimia'], spora: 'sporangi',
    w: { colore: 'grigio bianco | giallo', rovescio: 'chiaro | giallo', aspetto: 'cotonoso', crescita: 'rapida',
      strutture: 'sporangi', spore: 'sporangi', colorespore: 'brune | ialine', ife: 'cenocitiche' },
    pda: 'Crescita rapidissima, micelio lanoso, alto, da bianco a grigio o giallo bruno, che riempie la piastra in 2 o 3 giorni. Rovescio chiaro.',
    altri: 'Cresce su qualunque terreno.',
    micro: 'Ife larghe senza setti, niente rizoidi. Sporangiofori singoli o ramificati con sporangi globosi grigi o bruni, columella evidente, sporangiospore lisce.',
    confusione: 'Rhizopus (rizoidi e sporangi neri), oomiceti (ife sottili, niente sporangi globosi su fili alti).',
    lab: 'Contaminante comune, marciumi in post raccolta. Alcune specie sono patogeni opportunisti dell\'uomo.',
    loci: 'ITS e LSU.',
    refs: ['Walther et al. 2013, Persoonia 30, 11-47'],
  },
  {
    g: 'Phytophthora', fam: 'Oomycota, non è un fungo', gen: ['Phytophthora'], spora: 'oomiceti',
    w: { colore: 'bianco', rovescio: 'chiaro', aspetto: 'zone feltroso | cotonoso', crescita: 'media | rapida lenta',
      strutture: 'nessuna', spore: 'oomiceti', colorespore: 'ialine', ife: 'cenocitiche' },
    pda: 'Sulla PDA cresce ma sporula poco. Micelio bianco, spesso a petali, a rosetta o a crisantemo, con poco micelio aereo.',
    altri: 'V8 agar e CMA, con terreni selettivi come PARP o PARPH per l\'isolamento. Gli sporangi si formano in acqua di suolo o in soluzione salina dopo 1 o 2 giorni.',
    micro: 'Ife ialine senza setti, larghe 5 a 8 µm. Sporangi a limone o a pera, con papilla o senza, che liberano zoospore. Oospore tonde con parete spessa, clamidospore in alcune specie.',
    confusione: 'Pythium (crescita più rapida, sporangi tondi o filamentosi, oospore che riempiono l\'oogonio).',
    lab: 'Marciumi del colletto e delle radici, P. infestans dà la peronospora di patata e pomodoro. I fungicidi contro i funghi veri spesso non lo fermano.',
    loci: 'ITS e COX1, poi β-tubulina per le specie vicine.',
    refs: ['Erwin & Ribeiro 1996, Phytophthora Diseases Worldwide, APS Press', 'Abad et al. 2023, Studies in Mycology 106, 259-348'],
  },
  {
    g: 'Pythium', fam: 'Oomycota, non è un fungo', gen: ['Pythium', 'Globisporangium', 'Phytopythium'], spora: 'oomiceti',
    w: { colore: 'bianco', rovescio: 'chiaro', aspetto: 'cotonoso | feltroso', crescita: 'rapida',
      strutture: 'nessuna', spore: 'oomiceti', colorespore: 'ialine', ife: 'cenocitiche' },
    pda: 'Crescita rapidissima, riempie la piastra in 1 o 2 giorni, micelio bianco cotonoso, rovescio chiaro.',
    altri: 'CMA e V8, terreni selettivi come PARP. Pezzetti di erba sterili in acqua per gli sporangi.',
    micro: 'Ife ialine senza setti. Sporangi globosi o filamentosi e rigonfi, le zoospore si formano in una vescicola fuori dallo sporangio. Oogoni con un\'oospora, spesso quasi pieni.',
    confusione: 'Phytophthora (più lento, sporangi a limone), Mucorales (sporangi su fili lunghi e spore asciutte).',
    lab: 'Moria delle piantine e marciumi delle radici in serra e in vivaio.',
    loci: 'ITS e COX1.',
    refs: ['van der Plaats-Niterink 1981, Studies in Mycology 21, 1-242', 'Uzuhashi et al. 2010, Mycoscience 51, 337-365'],
  },
  {
    g: 'Monilinia', fam: 'Sclerotiniaceae, ifomicete', gen: ['Monilinia', 'Monilia'], spora: 'limoni',
    w: { colore: 'grigio crema | bianco oliva', rovescio: 'chiaro marrone | nero', aspetto: 'zone | cotonoso vellutato', crescita: 'media rapida',
      strutture: 'nessuna | sclerozi', spore: 'limoni', colorespore: 'ialine', ife: 'settate' },
    pda: 'Colonie grigie, nocciola o color camoscio. M. laxa ha il margine lobato a rosetta e poca sporulazione, M. fructicola anelli concentrici di spore, M. fructigena colonie crema o giallastre.',
    altri: 'PDA a 22 °C a luce alternata, la forma della colonia dopo 10 giorni serve per separare le specie.',
    micro: 'Conidi ovali o a limone, ialini, 10 a 20 × 7 a 12 µm, in catene ramificate che si staccano. Germinano con uno o due tubi.',
    confusione: 'Botrytis (conidi a grappolo, non in catena), Penicillium (spore molto più piccole e verdi).',
    lab: 'Marciume bruno di pesco, albicocco, ciliegio e susino, e delle pomacee (M. fructigena).',
    loci: 'ITS e TUB2, con PCR specifiche per M. fructicola, M. laxa e M. fructigena.',
    refs: ['EPPO 2020, PM 7/18 (3) Monilinia spp., EPPO Bulletin 50, 5-18', 'van Leeuwen et al. 2002, Mycological Research 106, 444-451'],
  },
  {
    g: 'Basidiomiceti del legno', fam: 'Pleurotus, Trametes e simili', gen: ['Pleurotus', 'Trametes', 'Ganoderma', 'Phanerochaete', 'Fomitiporia', 'Stereum', 'Athelia'], spora: 'nessuna',
    w: { colore: 'bianco | crema giallo', rovescio: 'chiaro | giallo', aspetto: 'cotonoso feltroso', crescita: 'rapida media',
      strutture: 'nessuna | gocce', spore: 'nessuna', colorespore: '', ife: 'fibbie | settate' },
    pda: 'Micelio bianco, feltroso o cotonoso, spesso aderente al terreno, crescita da media a rapida. Alcuni formano primordi o croste in piastra.',
    altri: 'MEA al 2% e agar con segatura. La prova con acido gallico o tannico (alone bruno) indica i funghi della carie bianca.',
    micro: 'Ife ialine con giunti a fibbia ai setti, il carattere che indica un basidiomicete. Di solito nessuna spora in coltura, a volte artroconidi o clamidospore.',
    confusione: 'Rhizoctonia (ife ad angolo retto senza fibbie), Sclerotinia (sclerozi neri).',
    lab: 'Carie del legno degli alberi e funghi coltivati. Fomitiporia mediterranea è coinvolta nel mal dell\'esca della vite.',
    loci: 'ITS e LSU.',
    refs: ['Stalpers 1978, Studies in Mycology 16, 1-248'],
  },
  {
    g: 'Aureobasidium', fam: 'Saccotheciaceae, lievito nero', gen: ['Aureobasidium'], spora: 'gemme',
    w: { colore: 'crema rosa nero | bianco', rovescio: 'chiaro nero', aspetto: 'mucoso', crescita: 'media rapida',
      strutture: 'nessuna', spore: 'gemme | teste', colorespore: 'ialine | brune', ife: 'settate scure' },
    pda: 'Colonie piatte, lisce e lucide, prima crema o rosa, poi con settori bruni o neri per le ife scure. Rovescio chiaro o nero.',
    altri: 'MEA e PDA a 25 °C.',
    micro: 'Ife ialine e ife scure con pareti spesse, conidi ellittici ialini che nascono tutti insieme dalle ife e poi gemmano come lieviti.',
    confusione: 'Lieviti veri (niente ife), Cladosporium e altri funghi neri (colonie vellutate, non lucide).',
    lab: 'Comunissimo sulle foglie e sui frutti, A. pullulans è usato come antagonista contro i marciumi in post raccolta.',
    loci: 'ITS e TEF1-α.',
    refs: ['Zalar et al. 2008, Studies in Mycology 61, 21-38'],
  },
  {
    g: 'Lieviti', fam: 'Saccharomycotina e basidiomiceti lievitiformi', gen: ['Candida', 'Rhodotorula', 'Saccharomyces', 'Pichia', 'Metschnikowia', 'Cryptococcus', 'Sporobolomyces'], spora: 'gemme',
    w: { colore: 'crema bianco | rosa arancio', rovescio: 'chiaro', aspetto: 'mucoso', crescita: 'media | rapida lenta',
      strutture: 'nessuna', spore: 'gemme', colorespore: 'ialine | arancio', ife: '| settate' },
    pda: 'Colonie piccole, lisce e lucide, cremose, bianche o crema, rosa o arancio in Rhodotorula e Sporobolomyces, senza micelio aereo.',
    altri: 'YPD o MEA. Sporobolomyces fa una copia della colonia sul coperchio con le spore lanciate.',
    micro: 'Cellule singole, ovali o tonde, che si moltiplicano per gemmazione. A volte pseudoife.',
    confusione: 'Aureobasidium giovane, che poi forma ife e settori scuri. Batteri (cellule molto più piccole).',
    lab: 'Spesso contaminanti nelle piastre e sui frutti. Alcuni sono antagonisti usati in post raccolta (Metschnikowia).',
    loci: 'ITS e il dominio D1/D2 della LSU.',
    refs: ['Kurtzman, Fell & Boekhout 2011, The Yeasts: A Taxonomic Study 5th ed., Elsevier'],
  },
];

// =====================================================================
//  Giro 43: come cresce, come farlo sporulare, i loci che confermano la
//  specie e le foto di riferimento.
//  conf: i loci che bastano per dire "identificato" (uno dei due o tre).
//  cresce: t temperatura, v velocità, terreni [terreno, a cosa serve].
//  spor: terreno, luce, temp, giorni in breve, poi i passi e una nota.
//  atlas: la pagina di Mycology Online (Adelaide University) e alcune foto,
//  licenza CC BY-NC 4.0, mostrate con il credito e il collegamento.
//  Protocolli da Leslie & Summerell 2006, Simmons 2007, Visagie et al.
//  2014, Bensch et al. 2012, Phillips et al. 2013, Lamari & Bernier 1989,
//  Erwin & Ribeiro 1996, Van der Plaats-Niterink 1981, EPPO PM 7/18.
// =====================================================================
const AD = 'https://mycology.adelaide.edu.au';
const ADH = `${AD}/fungal-descriptions-and-antifungal-susceptibility/hyphomycetes-conidial-moulds/`;
const ADC = `${AD}/fungal-descriptions-and-antifungal-susceptibility/coelomycetes`;
const ADI = (p) => `${AD}/sites/default/files/styles/${p}`;
export const ATLAS_CREDIT = 'Mycology Online, Adelaide University, CC BY-NC 4.0';
// giro 46: le foto dei nostri isolati (endofiti del grano, Agritech 2023-24) portano questo credito
export const LAB_CREDIT = 'Plant Pathology Lab, Sapienza';
// giro 44: per i generi che l'atlante non ha, figure di articoli open access (MDPI, CC BY).
// Ogni foto porta il suo credito e la pagina dell'articolo: [src, didascalia, credito, pagina]
const MD = (j, a, g) => `https://mdpi-res.com/${j}/${a}/article_deploy/html/images/${a}-${g}-550.jpg`;
const COLTURA = {
  Fusarium: {
    conf: ['TEF1', 'RPB1', 'RPB2'],
    cresce: { t: 'Ottimo da 22 a 28 °C, cresce da circa 5 a 35 °C', v: 'Rapida, da 4 a 9 cm in 7 giorni a 25 °C su PDA',
      terreni: [['PDA', 'velocità, colore del micelio e del rovescio'], ['CLA', 'sporodochi e macroconidi tipici'], ['SNA', 'microconidi, catene e clamidospore'], ['CMC liquido', 'molti conidi per gli inoculi']] },
    spor: { terreno: 'CLA o SNA', luce: '12 h luce e 12 h buio, meglio con NUV', temp: '25 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Prendi un pezzetto dal margine della colonia, meglio da una spora singola.', 'Mettilo su CLA o SNA, vicino ai pezzetti di garofano o di carta.',
        'Incuba a 25 °C con 12 ore di luce (neon bianco e NUV) e 12 di buio.', 'Dopo 7 a 10 giorni guarda gli sporodochi arancio sui pezzetti. I macroconidi si prendono da lì.',
        'Per tanti conidi di F. graminearum usa il brodo CMC agitato a 25 °C, pronti in 4 a 7 giorni.'],
      nota: 'Le ripicche ripetute su PDA fanno perdere la capacità di sporulare. Conserva da spora singola e ripicca su SNA.' },
    atlas: { url: `${ADH}fusarium`, img: [
      [ADI('ua_image/public/media/images/2021-07/fus-cult.jpg?itok=jkiSnuHw'), 'Colonie di F. oxysporum (viola) e F. subglutinans (rosa)'],
      [ADI('ua_gallery_thumbnail/public/media/images/2021-10/fus-oxy-micro4.jpg?h=c4dd2c7b&itok=9g8WZ-qs'), 'Micro e macroconidi di F. oxysporum'],
      [ADI('ua_gallery_thumbnail/public/media/images/2021-09/fus-sol-micro3.jpg?h=c4dd2c7b&itok=atRm_JLe'), 'Macroconidi di F. solani']] },
  },
  Microdochium: {
    conf: ['RPB2', 'TUB2'],
    cresce: { t: 'Ottimo da 18 a 22 °C, cresce anche da 0 a 5 °C, si ferma sopra 30 °C', v: 'Media, da 3 a 6 cm in 7 giorni',
      terreni: [['PDA', 'colonia salmone e sporodochi'], ['SNA', 'conidi per il microscopio']] },
    spor: { terreno: 'PDA o SNA', luce: '12 h luce e 12 h buio, con NUV', temp: 'da 18 a 20 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su PDA o SNA dal margine della colonia.', 'Incuba a 18 a 20 °C con luce alternata, meglio con NUV.', 'Gli sporodochi arancio e mucosi compaiono dopo 7 a 14 giorni.'],
      nota: 'Alcuni isolati sporulano poco. Prova con pezzetti sterili di foglia di grano su agar acqua.' },
    atlas: { img: [
      [MD('microorganisms', 'microorganisms-08-00340', 'g002'), 'Colonie di M. majus, M. nivale e M. seminicola su PSA e OA', 'Gagkaeva et al. 2020, Microorganisms, CC BY', 'https://www.mdpi.com/2076-2607/8/3/340'],
      [MD('microorganisms', 'microorganisms-08-00340', 'g004'), 'M. nivale, conidi, conidiofori, periteci e ascospore', 'Gagkaeva et al. 2020, Microorganisms, CC BY', 'https://www.mdpi.com/2076-2607/8/3/340']] },
  },
  Aspergillus: {
    conf: ['CaM', 'TUB2'],
    cresce: { t: 'Ottimo da 25 a 35 °C. A. fumigatus cresce fino a 50 °C, A. flavus e A. niger bene a 37 °C', v: 'Da media a rapida, da 3 a 7 cm in 7 giorni su CYA a 25 °C',
      terreni: [['CYA', 'velocità e colore, a 25 e a 37 °C'], ['MEA', 'teste conidiali per il microscopio'], ['YES', 'pigmenti e metaboliti'], ['AFPA', 'rovescio arancio della sezione Flavi (A. flavus, A. parasiticus)']] },
    spor: { terreno: 'MEA o CYA', luce: 'non serve', temp: '25 °C', giorni: 'da 3 a 7 giorni',
      passi: ['Inocula in tre punti su MEA o CYA, con l\'ago o una goccia di sospensione.', 'Incuba a 25 °C, anche al buio.', 'Sporula in 3 a 5 giorni. Le teste si guardano dopo 5 a 7 giorni.'],
      nota: 'Sporula da solo. Chiudi le piastre con il parafilm e aprile sotto cappa.' },
    atlas: { url: `${ADH}aspergillus`, img: [
      [ADI('ua_image/public/media/images/2021-07/asp-flav-cult.jpg?itok=nqzEnNHj'), 'Colonia e testa conidiale di A. flavus'],
      [ADI('ua_gallery_thumbnail/public/media/images/2021-07/asp-niger-cult.jpg?h=20ecee81&itok=XuJxDu-1'), 'Colonia di A. niger'],
      [ADI('ua_image/public/media/images/2021-07/asp-fum-micro.jpg?itok=MA3hszQu'), 'Teste conidiali di A. fumigatus, fialidi su una fila']] },
  },
  Penicillium: {
    conf: ['TUB2', 'CaM', 'RPB2'],
    cresce: { t: 'Ottimo da 20 a 25 °C. Molte specie crescono a 5 °C, poche a 37 °C', v: 'Da lenta a media, da 1,5 a 5 cm in 7 giorni su CYA a 25 °C',
      terreni: [['CYA', 'velocità e colore, anche a 30 e 37 °C'], ['MEA', 'penicilli per il microscopio'], ['YES', 'pigmenti e rovescio'], ['CREA', 'acidi, il viola diventa giallo']] },
    spor: { terreno: 'CYA e MEA', luce: 'buio', temp: '25 °C', giorni: '7 giorni',
      passi: ['Fai una sospensione di spore in agar semisolido (0,2 % di agar e 0,05 % di Tween 80).', 'Inocula in tre punti su CYA e MEA.', 'Incuba a 25 °C al buio per 7 giorni, a faccia in giù.', 'Guarda i penicilli su MEA, in acido lattico.'],
      nota: 'Sporula da solo. Tieni le piastre chiuse, le spore si spargono facilmente.' },
    atlas: { url: `${ADH}penicillium`, img: [
      [ADI('ua_image/public/media/images/2021-07/pen-cult.jpg?itok=cxZ4lKQX'), 'Colonie di Penicillium'],
      [ADI('ua_image/public/media/images/2021-07/pen-micro.jpg?itok=DL6eBxC5'), 'Penicilli semplici e ramificati con le catene di conidi']] },
  },
  Alternaria: {
    conf: ['GAPDH', 'RPB2', 'TEF1'],
    cresce: { t: 'Ottimo da 22 a 28 °C, cresce da circa 2 a 35 °C', v: 'Da media a rapida, da 4 a 8 cm in 7 giorni su PDA',
      terreni: [['PDA', 'colonia e rovescio, sporula poco'], ['PCA', 'catene di conidi'], ['V8', 'conidi delle specie a spore grandi']] },
    spor: { terreno: 'PCA o V8', luce: '8 h luce e 16 h buio', temp: '22 °C', giorni: '7 giorni',
      passi: ['Ripicca su PCA o V8, al centro.', 'Incuba a 22 °C con 8 ore di luce bianca o NUV e 16 di buio.', 'Dopo 7 giorni guarda le catene direttamente nella piastra, a basso ingrandimento senza toccarle.',
        'Se non sporula, gratta il micelio con una spatola sterile e rimetti alla luce. I conidi si formano in 1 o 2 giorni.'] },
    atlas: { url: `${ADH}alternaria`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/alternariacul2_0.jpg?h=eec299da&itok=TInHBEhB'), 'Colonie di A. alternata'],
      [ADI('ua_image_landscape/public/media/images/2021-09/alternaria_0.jpg?h=13ab60f9&itok=_3ke2hdc'), 'Catene ramificate di conidi di A. alternata']] },
  },
  Stemphylium: {
    conf: ['GAPDH', 'CaM'],
    cresce: { t: 'Ottimo da 22 a 25 °C', v: 'Media, da 3 a 7 cm in 7 giorni',
      terreni: [['PDA', 'colonia'], ['V8', 'conidi'], ['PCA', 'conidi']] },
    spor: { terreno: 'V8 o PCA', luce: '12 h NUV e 12 h buio', temp: '22 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su V8 o PCA.', 'Incuba a 22 °C con 12 ore di NUV e 12 di buio.', 'I conidi compaiono in 7 a 14 giorni.', 'Per gli pseudoteci (Pleospora) lascia le piastre a 10 a 15 °C per alcune settimane.'] },
    atlas: { url: `${ADH}stemphylium`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/stempphylium.jpg?h=e50cc7ce&itok=TewkEfV_'), 'Conidiofori e conidi di Stemphylium']] },
  },
  Cladosporium: {
    conf: ['TEF1', 'ACT'],
    cresce: { t: 'Ottimo da 20 a 25 °C, cresce anche a 4 °C, quasi niente a 37 °C', v: 'Lenta, da 1,5 a 4 cm in 7 giorni su PDA',
      terreni: [['PDA', 'colonia'], ['MEA', 'colonia'], ['SNA', 'conidiofori per il microscopio']] },
    spor: { terreno: 'PDA, MEA o SNA', luce: 'luce del laboratorio', temp: '25 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Sporula da solo su PDA e MEA in una settimana.', 'Per il microscopio usa SNA a 25 °C per 7 giorni, con luce.', 'Monta con lo scotch o guarda nella piastra, le catene si rompono appena le tocchi.'] },
    atlas: { url: `${ADH}cladosporium`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-07/cladospor-cult.jpg?h=07af5e35&itok=c5kzISqh'), 'Colonia di C. cladosporioides'],
      [ADI('ua_image_landscape/public/media/images/2021-07/cladospor-micro.jpg?h=e6239c2e&itok=E2XyaZ7T'), 'Conidiofori e conidi di C. cladosporioides']] },
  },
  Trichoderma: {
    conf: ['TEF1', 'RPB2'],
    cresce: { t: 'Ottimo da 25 a 30 °C, molte specie crescono a 35 °C', v: 'Molto rapida, riempie la piastra in 3 o 4 giorni',
      terreni: [['PDA', 'colonia e anelli di spore verdi'], ['SNA o CMD', 'conidiofori e fialidi'], ['PDA a 25, 30 e 35 °C', 'velocità che aiuta a separare le specie']] },
    spor: { terreno: 'PDA, poi SNA', luce: '12 h luce e 12 h buio', temp: '25 °C', giorni: 'da 3 a 7 giorni',
      passi: ['Ripicca su PDA al centro.', 'Incuba a 25 °C con luce alternata. Le pustole verdi si formano ad anelli, uno per ogni ciclo di luce.', 'Per i conidiofori usa SNA o CMD dopo 5 a 7 giorni.'],
      nota: 'Al buio molti isolati restano bianchi. Copre in fretta le altre piastre, tienilo separato.' },
    atlas: { url: `${ADH}trichoderma`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/trichoderma.jpg?h=11824060&itok=M5JK0Kni'), 'Fialidi e conidi di T. harzianum']] },
  },
  Botrytis: {
    conf: ['GAPDH', 'HSP60', 'RPB2'],
    cresce: { t: 'Ottimo da 20 a 22 °C, cresce da 0 a 30 °C', v: 'Rapida, riempie la piastra in 5 a 7 giorni a 20 °C',
      terreni: [['PDA', 'colonia, sclerozi e conidi'], ['MEA', 'colonia']] },
    spor: { terreno: 'PDA', luce: '12 h NUV e 12 h buio', temp: '20 °C', giorni: 'da 7 a 10 giorni',
      passi: ['Ripicca su PDA al centro.', 'Incuba a 20 °C con NUV o luce bianca per 12 ore al giorno.', 'I conidiofori grigi compaiono in 7 a 10 giorni, prima al margine.', 'Se fa solo sclerozi, metti sulla colonia un pezzetto sterile di foglia o di frutto.'],
      nota: 'Al buio fa soprattutto sclerozi e poche spore.' },
    atlas: { img: [
      [MD('microbiolres', 'microbiolres-16-00219', 'g002'), 'Colonie di B. cinerea su PDA dopo 14 giorni a 21 °C, con sclerozi, e conidiofori con i conidi a grappolo', 'Aoujil et al. 2025, Microbiology Research, CC BY', 'https://www.mdpi.com/2036-7481/16/10/219']] },
  },
  Sclerotinia: {
    conf: ['GAPDH', 'HSP60', 'RPB2'],
    cresce: { t: 'Ottimo da 20 a 25 °C, cresce da 0 a 30 °C', v: 'Molto rapida, riempie la piastra in 3 o 4 giorni',
      terreni: [['PDA', 'micelio bianco e sclerozi neri']] },
    spor: { terreno: 'PDA, poi sabbia umida', temp: '20 °C, poi 4 °C e 15 °C', giorni: 'sclerozi in 7 a 14 giorni, apoteci in 2 o 3 mesi',
      passi: ['Su PDA a 20 °C gli sclerozi si formano al margine in 7 a 14 giorni.', 'Per gli apoteci raccogli gli sclerozi e tienili a 4 °C al buio per 4 a 8 settimane.', 'Poi mettili su sabbia o terriccio umido a 15 °C con luce.', 'Gli apoteci escono dopo 3 a 8 settimane e lanciano le ascospore.'],
      nota: 'In coltura non fa spore asessuate. Fa sclerozi e, a parte, gli apoteci con le ascospore.' },
    atlas: { img: [
      [MD('jof', 'jof-08-00755', 'g003'), 'Colonie di S. sclerotiorum su PDA, con sclerozi al margine e sparsi', 'Rather et al. 2022, Journal of Fungi, CC BY', 'https://www.mdpi.com/2309-608X/8/7/755'],
      [MD('jof', 'jof-08-00755', 'g008'), 'Sclerozi in germinazione, apoteci, aschi e ascospore', 'Rather et al. 2022, Journal of Fungi, CC BY', 'https://www.mdpi.com/2309-608X/8/7/755']] },
  },
  Rhizoctonia: {
    conf: ['ITS'],
    cresce: { t: 'Ottimo da 25 a 28 °C, cresce da circa 5 a 35 °C', v: 'Molto rapida, riempie la piastra in 2 a 4 giorni',
      terreni: [['PDA', 'colonia e sclerozi bruni'], ['WA', 'ife ad angolo retto e anastomosi']] },
    spor: { terreno: 'PDA o WA', temp: '25 °C', giorni: 'sclerozi in 1 a 3 settimane',
      passi: ['Su PDA a 25 °C gli sclerozi bruni compaiono in 1 a 3 settimane.', 'Per contare i nuclei colora le ife giovani con safranina O o DAPI.',
        'Per il gruppo di anastomosi appaia l\'isolato con i ceppi di riferimento su WA e guarda le fusioni dopo 1 o 2 giorni.', 'Per la forma sessuata copri la colonia con uno strato di terra umida e tienila alla luce. A volte compare in 1 a 3 settimane.'],
      nota: 'Non fa spore asessuate. Si riconosce dalle ife, dai nuclei e dal gruppo di anastomosi.' },
    atlas: { img: [
      [MD('microorganisms', 'microorganisms-07-00088', 'g001'), 'Colonie di R. solani di 10 giorni e ife ramificate ad angolo retto, con strozzatura e setto', 'Sandoval et al. 2019, Microorganisms, CC BY', 'https://www.mdpi.com/2076-2607/7/3/88'],
      [MD('plants', 'plants-13-00715', 'g001'), 'R. solani AG-3, colonia fronte e retro e ife ad angolo retto, con i sintomi su patata', 'Naqvi et al. 2024, Plants, CC BY', 'https://www.mdpi.com/2223-7747/13/5/715']] },
  },
  Colletotrichum: {
    conf: ['GAPDH', 'ACT', 'TUB2', 'H3'],
    cresce: { t: 'Ottimo da 25 a 28 °C, cresce da circa 10 a 35 °C', v: 'Da media a rapida, da 4 a 8 cm in 7 giorni su PDA',
      terreni: [['PDA', 'colonia e masse di conidi arancio'], ['SNA con pezzetti sterili', 'conidi e appressori'], ['OA', 'acervuli e setole']] },
    spor: { terreno: 'PDA, o SNA con pezzetti sterili', luce: '12 h luce e 12 h buio, con NUV', temp: '25 °C', giorni: 'da 7 a 10 giorni',
      passi: ['Ripicca su PDA, oppure su SNA con un pezzetto di fusto o di carta sterile.', 'Incuba a 25 °C con luce alternata e NUV.', 'Le masse di conidi arancio escono dagli acervuli in 7 a 10 giorni.', 'Per gli appressori fai una coltura su vetrino con SNA e guardali dopo 5 a 7 giorni.'],
      nota: 'Le ripicche ripetute possono rendere l\'isolato sterile. Conserva da spora singola.' },
    atlas: { url: `${ADC}#colletotrichum-coccodes`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/coll-cult.jpg?h=73c81d8d&itok=wwTgeVEr'), 'Colonia, conidi e appressori di C. coccodes'],
      [ADI('ua_image_landscape/public/media/images/2021-09/coll-pycnid3.jpg?h=cfa2f048&itok=5CS5OS5A'), 'Sclerozi con setole di C. coccodes']] },
  },
  'Phoma e Didymella': {
    conf: ['RPB2', 'TUB2'],
    cresce: { t: 'Ottimo da 20 a 25 °C', v: 'Media, da 3 a 7 cm in 7 giorni su OA',
      terreni: [['OA', 'picnidi e colore della colonia'], ['MEA', 'colonia e prova della goccia di NaOH'], ['PDA', 'colonia']] },
    spor: { terreno: 'OA', luce: '12 h NUV e 12 h buio', temp: '22 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su OA (agar d\'avena).', 'Incuba a 22 °C con NUV per 12 ore al giorno.', 'I picnidi scuri si vedono allo stereo in 7 a 14 giorni, le spore escono in cirri.', 'Su MEA una goccia di NaOH aiuta per alcune specie, il colore cambia in pochi minuti.'] },
    atlas: { url: `${ADC}#phoma-spp`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/phoma-pycnidia.jpg?h=cfa2f048&itok=BDlD17Xf'), 'Picnidio di Phoma'],
      [ADI('ua_image_landscape/public/media/images/2021-09/pycnidia.jpg?h=cfa2f048&itok=pCsc3RRX'), 'Picnidio di Phoma in sezione']] },
  },
  Botryosphaeriaceae: {
    conf: ['TEF1', 'TUB2', 'RPB2'],
    cresce: { t: 'Ottimo da 25 a 30 °C. Lasiodiplodia e Macrophomina crescono anche a 35 °C', v: 'Molto rapida, riempie la piastra in 2 a 4 giorni',
      terreni: [['PDA', 'colonia, raramente picnidi'], ['WA con aghi di pino', 'picnidi e conidi'], ['PDA per Macrophomina', 'microsclerozi neri in 3 a 7 giorni']] },
    spor: { terreno: 'WA con aghi di pino sterili', luce: 'NUV o luce diffusa', temp: '25 °C', giorni: 'da 2 a 4 settimane',
      passi: ['Autoclava aghi di pino e appoggiali su agar acqua al 2 %.', 'Metti un pezzetto della colonia vicino agli aghi.', 'Incuba a 25 °C con NUV o luce diffusa.', 'I picnidi neri crescono sugli aghi in 2 a 4 settimane.', 'In Lasiodiplodia e Diplodia i conidi diventano scuri solo da vecchi, in Neofusicoccum restano chiari.'],
      nota: 'Su PDA riempie la piastra in pochi giorni ma raramente fa picnidi.' },
    atlas: { url: `${ADC}#lasiodiplodia-theobromae`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/laso-cult.jpg?h=cfa2f048&itok=sRq0RWYd'), 'Picnidi di L. theobromae su CLA'],
      [ADI('ua_image_landscape/public/media/images/2021-09/laso-micro.jpg?h=cfa2f048&itok=RRCT7Fvf'), 'Conidi maturi di L. theobromae, bruni e striati']] },
  },
  Epicoccum: {
    conf: ['RPB2', 'TUB2'],
    cresce: { t: 'Ottimo da 23 a 28 °C', v: 'Media, da 3 a 6 cm in 7 giorni',
      terreni: [['PDA', 'colonia e pigmento giallo o arancio nel terreno'], ['OA', 'sporodochi']] },
    spor: { terreno: 'OA o PDA', luce: '12 h luce e 12 h buio', temp: '25 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su OA o PDA.', 'Incuba a 25 °C con luce alternata.', 'Gli sporodochi neri, come puntini, compaiono in 7 a 14 giorni.'],
      nota: 'Alcuni isolati restano sterili. Il pigmento giallo o arancio nel terreno aiuta lo stesso.' },
    atlas: { url: `${ADH}epicoccum-nigrum`, img: [
      [ADI('ua_image/public/media/images/2021-07/epicoccum.jpg?itok=6dQLY7gc'), 'Colonia e conidi di E. nigrum']] },
  },
  Nigrospora: {
    conf: ['TEF1', 'TUB2'],
    cresce: { t: 'Ottimo intorno a 25 °C', v: 'Rapida, riempie la piastra in 5 a 7 giorni',
      terreni: [['PDA', 'colonia e spore'], ['MEA', 'colonia']] },
    spor: { terreno: 'PDA', luce: '12 h luce e 12 h buio', temp: '25 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su PDA.', 'Incuba a 25 °C con luce alternata.', 'Le spore nere, tonde e lucide si formano in 1 o 2 settimane, prima sul micelio vecchio al centro.'] },
    atlas: { img: [
      [MD('jof', 'jof-10-00156', 'g003'), 'Nigrospora su PDA a 2 e 4 giorni, ife e conidi neri e tondi', 'Liu et al. 2024, Journal of Fungi, CC BY', 'https://www.mdpi.com/2309-608X/10/2/156'],
      [MD('horticulturae', 'horticulturae-09-01067', 'g007'), 'Colonie su PDA fronte e retro e conidi neri di tre specie di Nigrospora', 'Petrović et al. 2023, Horticulturae, CC BY', 'https://www.mdpi.com/2311-7524/9/10/1067']] },
  },
  'Bipolaris e Drechslera': {
    conf: ['GAPDH', 'TEF1'],
    cresce: { t: 'Ottimo da 25 a 30 °C per Bipolaris e Curvularia, da 20 a 22 °C per Drechslera e Pyrenophora', v: 'Da media a rapida, da 4 a 8 cm in 7 giorni',
      terreni: [['PDA', 'colonia'], ['V8', 'conidi'], ['PCA', 'conidi'], ['WA con foglie sterili', 'conidi come sulla pianta']] },
    spor: { terreno: 'V8 o PCA', luce: '12 h luce e 12 h buio, con NUV', temp: 'da 22 a 25 °C', giorni: 'da 7 a 14 giorni',
      passi: ['Ripicca su V8 o PCA, o su agar acqua con pezzetti di foglia sterili.', 'Incuba a 22 a 25 °C con luce alternata e NUV.',
        'Per Pyrenophora tritici-repentis fai crescere 5 giorni al buio, poi schiaccia il micelio con acqua sterile.', 'Poi 24 ore di luce a 22 °C e 24 ore di buio a 15 °C. I conidi si formano al buio.'] },
    atlas: { url: `${ADH}curvularia`, img: [
      [ADI('ua_gallery_thumbnail/public/media/images/2021-07/curvularia-cult.jpg?h=853d34f8&itok=SNUjrhyw'), 'Colonia di C. lunata'],
      [ADI('ua_image/public/media/images/2021-07/bipolaris-micro.jpg?itok=RAU2y_vy'), 'Conidi di C. australiensis su rachide a zig zag'],
      [ADI('ua_gallery_thumbnail/public/media/images/2021-09/curv-micro.jpg?h=c4dd2c7b&itok=MJ_FqXR-'), 'Conidi di C. lunata']] },
  },
  Verticillium: {
    conf: ['ACT', 'TEF1', 'GAPDH'],
    cresce: { t: 'Ottimo da 22 a 25 °C. V. dahliae cresce a 30 °C, V. albo-atrum no', v: 'Lenta, da 2 a 4 cm in 7 giorni su PDA',
      terreni: [['PDA', 'colonia, conidi e microsclerozi'], ['Czapek liquido', 'conidi per gli inoculi']] },
    spor: { terreno: 'PDA', luce: 'non serve', temp: 'da 22 a 24 °C', giorni: 'conidi in 5 a 7 giorni, microsclerozi in 2 o 3 settimane',
      passi: ['Ripicca su PDA a 22 a 24 °C. I conidi in testine si formano in 5 a 7 giorni.', 'I microsclerozi di V. dahliae anneriscono la colonia in 2 o 3 settimane.', 'Per molti conidi da inoculo usa il brodo Czapek agitato per 5 a 7 giorni, poi filtra.'] },
    atlas: { url: `${ADH}verticillium`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/verticillium-copy.jpg?h=c4dd2c7b&itok=hbZJrad5'), 'Conidiofori, fialidi e conidi di Verticillium']] },
  },
  Rhizopus: {
    conf: ['ITS'],
    cresce: { t: 'Ottimo da 25 a 35 °C. R. stolonifer non cresce a 37 °C, R. arrhizus e R. microsporus sì', v: 'Velocissima, riempie la piastra in 2 o 3 giorni',
      terreni: [['PDA', 'colonia e sporangi'], ['MEA', 'colonia e sporangi']] },
    spor: { terreno: 'PDA o MEA', luce: 'non serve', temp: '25 °C', giorni: 'da 2 a 4 giorni',
      passi: ['Sporula da solo su PDA in 2 o 3 giorni.', 'Prendi gli sporangi con l\'ago o con lo scotch, senza aprire troppo la piastra.'],
      nota: 'Invade le piastre vicine. Chiudile con il parafilm e tienile separate.' },
    atlas: { url: `${AD}/rhizopus`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/rhizo-arr-cult.jpg?h=c4dd2c7b&itok=hLGpY4w1'), 'Colonia e sporangio di R. arrhizus'],
      [ADI('ua_image_landscape/public/media/images/2021-09/rhizo-arr-micro.jpg?h=c4dd2c7b&itok=auN7cA7o'), 'Sporangiofori, rizoidi e sporangi di R. arrhizus']] },
  },
  Mucor: {
    conf: ['ITS'],
    cresce: { t: 'Ottimo da 20 a 25 °C, molte specie non crescono a 37 °C', v: 'Molto rapida, riempie la piastra in 3 o 4 giorni',
      terreni: [['PDA', 'colonia e sporangi'], ['MEA', 'colonia e sporangi']] },
    spor: { terreno: 'PDA o MEA', luce: 'non serve', temp: '25 °C', giorni: 'da 3 a 5 giorni',
      passi: ['Sporula da solo su PDA in 3 a 5 giorni.', 'Guarda gli sporangi con lo scotch o in acqua, la columella si vede bene quando la parete si rompe.'],
      nota: 'Le zigospore si formano solo incrociando due ceppi di segno opposto.' },
    atlas: { url: `${AD}/fungal-descriptions-and-antifungal-susceptibility/mucoromycota-pin-moulds/mucor`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/mucor-circ-cult.jpg?h=c4dd2c7b&itok=r-qcG7oc'), 'Colonia di M. circinelloides'],
      [ADI('ua_image_landscape/public/media/images/2021-09/mucor-sporang.jpg?h=c4dd2c7b&itok=2DXWkhXj'), 'Sporangi, columella e sporangiospore di Mucor']] },
  },
  Phytophthora: {
    conf: ['ITS', 'COX1'],
    cresce: { t: 'Ottimo da 20 a 28 °C secondo la specie, P. infestans da 18 a 20 °C', v: 'Da lenta a media. P. cinnamomi e P. cactorum riempiono la piastra in circa una settimana, P. infestans è più lento',
      terreni: [['V8 chiarificato', 'colonia, sporangi e oospore'], ['CMA', 'colonia, con PARPH per isolare'], ['Agar di segale', 'P. infestans']] },
    spor: { terreno: 'V8, poi estratto di terreno', luce: 'luce del laboratorio', temp: 'da 20 a 25 °C', giorni: 'da 4 a 7 giorni, poi da 1 a 3',
      passi: ['Fai crescere su V8 per 4 a 7 giorni.', 'Taglia dischetti dal margine e mettili in una piastra vuota, coperti di estratto di terreno non sterile o acqua di stagno.',
        'Lascia alla luce a 20 a 25 °C. Gli sporangi si formano in 1 a 3 giorni.', 'Per liberare le zoospore metti a 4 °C per 20 o 30 minuti, poi a temperatura ambiente per 30 minuti.',
        'Le specie omotalliche fanno le oospore da sole su V8 al buio in 2 a 4 settimane. Per le eterotalliche servono A1 e A2 nella stessa piastra.'],
      nota: 'P. infestans cresce su agar di segale a 18 °C e fa gli sporangi direttamente sulla colonia in 10 a 14 giorni.' },
    atlas: { img: [
      [MD('forests', 'forests-14-01459', 'g002'), 'P. nicotianae, colonia di 3 giorni su V8 fronte e retro, sporangi papillati, zoospore e clamidospora', 'Zhou et al. 2023, Forests, CC BY', 'https://www.mdpi.com/1999-4907/14/7/1459'],
      [MD('plants', 'plants-13-01602', 'g006'), 'P. capsici, oogoni con oospore e anteridi anfigini', 'Soto-Contreras et al. 2024, Plants, CC BY', 'https://www.mdpi.com/2223-7747/13/12/1602']] },
  },
  Pythium: {
    conf: ['ITS', 'COX1'],
    cresce: { t: 'Ottimo da 25 a 30 °C per P. ultimum, P. aphanidermatum fino a 40 °C, alcune specie del freddo', v: 'Velocissima, riempie la piastra in 1 a 3 giorni',
      terreni: [['CMA', 'colonia, oogoni e oospore'], ['PCA o V8', 'colonia'], ['PARP', 'per isolare']] },
    spor: { terreno: 'CMA con fili d\'erba sterili, poi acqua', luce: 'luce del laboratorio', temp: 'da 20 a 25 °C', giorni: 'da 1 a 3 giorni',
      passi: ['Metti fili d\'erba autoclavati su una colonia giovane su CMA per 24 ore.', 'Spostali in una piastra con acqua di stagno o acqua sterile.', 'Lascia a 20 a 25 °C. Sporangi e zoospore compaiono in 1 a 3 giorni.', 'Oogoni e oospore si vedono su CMA o su semi di canapa in 3 a 7 giorni.'],
      nota: 'P. ultimum quasi non fa zoospore, si riconosce dagli oogoni e dagli sporangi tondi.' },
    atlas: { url: `${AD}/fungal-descriptions-and-antifungal-susceptibility/pythium-oomycota`, img: [
      [MD('jof', 'jof-07-00479', 'g002'), 'Pythium kashmirense, colonie di 7 giorni su PDA, MEA, V8 e agar carota, sporangi, zoospore incistate e oogoni', 'Benavent-Celma et al. 2021, Journal of Fungi, CC BY', 'https://www.mdpi.com/2309-608X/7/6/479'],
      [MD('plants', 'plants-12-01361', 'g005'), 'Globisporangium commune, sporangi, zoospore, oogoni e oospore con anteridi', 'Liu et al. 2023, Plants, CC BY', 'https://www.mdpi.com/2223-7747/12/6/1361']] },
  },
  Monilinia: {
    conf: ['TUB2'],
    cresce: { t: 'Ottimo da 20 a 25 °C, M. fructicola un po\' più alto di M. laxa', v: 'M. fructicola rapida e regolare, M. laxa più lenta e a lobi',
      terreni: [['PDA', 'colonia, rosette e conidi']] },
    spor: { terreno: 'PDA', luce: '12 h luce e 12 h buio', temp: '22 °C', giorni: 'da 7 a 10 giorni',
      passi: ['Ripicca su PDA.', 'Incuba a 22 °C con 12 ore di luce.', 'M. fructicola sporula molto, M. laxa poco e a rosette, M. fructigena con masse color crema.',
        'Se non sporula, infetta un frutto ferito (mela o pesca) e tienilo in camera umida a 22 °C. Le spore escono in 4 a 7 giorni.'] },
    atlas: { img: [
      [MD('jof', 'jof-11-00690', 'g002'), 'Colonie di M. fructigena, M. laxa, M. polystroma e M. fructicola su PDA dopo 27 giorni, fronte e retro', 'Pagano et al. 2025, Journal of Fungi, CC BY', 'https://www.mdpi.com/2309-608X/11/10/690'],
      [MD('agronomy', 'agronomy-13-01493', 'g001'), 'M. fructicola, colonia di 7 giorni su PDA e conidi in catene ramificate', 'Baltazar et al. 2023, Agronomy, CC BY', 'https://www.mdpi.com/2073-4395/13/6/1493']] },
  },
  'Basidiomiceti del legno': {
    conf: ['ITS'],
    cresce: { t: 'Ottimo da 25 a 30 °C', v: 'Da media a rapida secondo la specie',
      terreni: [['MEA', 'colonia e giunti a fibbia'], ['PDA', 'colonia']] },
    spor: { terreno: 'paglia o segatura', temp: '25 °C, poi da 12 a 18 °C', giorni: 'da 3 a 6 settimane',
      passi: ['Per Pleurotus inocula paglia o segatura umida e sterile e lasciala invadere dal micelio, di solito 2 a 4 settimane a 25 °C.', 'Poi abbassa a 12 a 18 °C, con luce e umidità alta. I funghi escono in 1 o 2 settimane.'],
      nota: 'In coltura fanno solo micelio. Giunti a fibbia e sequenza ITS bastano per il genere.' },
    atlas: { img: [
      [MD('pathogens', 'pathogens-14-00532', 'g003'), 'Trametes hirsuta, colonia su PDA, micelio, basidi e spora', 'Mendoza-Churape et al. 2025, Pathogens, CC BY', 'https://www.mdpi.com/2076-0817/14/6/532'],
      [MD('foods', 'foods-12-00465', 'g001'), 'Ganoderma lucidum, colonie e giunti a fibbia nelle ife (cerchiati)', 'Tang et al. 2023, Foods, CC BY', 'https://www.mdpi.com/2304-8158/12/3/465']] },
  },
  Aureobasidium: {
    conf: ['ITS', 'TEF1'],
    cresce: { t: 'Ottimo da 20 a 25 °C, cresce anche a 4 °C', v: 'Media, da 2 a 5 cm in 7 giorni',
      terreni: [['PDA', 'colonia'], ['MEA', 'colonia']] },
    spor: { terreno: 'PDA o MEA', luce: 'non serve', temp: '25 °C', giorni: 'da 3 a 14 giorni',
      passi: ['Sporula da solo. Le cellule che gemmano si vedono già dopo 2 o 3 giorni.', 'Ife scure e artroconidi compaiono in 7 a 14 giorni, con le colonie che anneriscono.'] },
    atlas: { url: `${ADH}aureobasidium`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/aureo-cult_0.jpg?h=c4dd2c7b&itok=mkLgy8hd'), 'Colonia di A. pullulans con masse nere di conidi'],
      [ADI('ua_image_landscape/public/media/images/2021-09/aureo-micro.jpg?h=c4dd2c7b&itok=aeNnzvm8'), 'Artroconidi scuri e conidi chiari di A. pullulans']] },
  },
  Lieviti: {
    conf: ['ITS', 'LSU'],
    cresce: { t: 'Ottimo da 25 a 30 °C', v: 'Colonie visibili in 2 o 3 giorni',
      terreni: [['YPD', 'colonia'], ['MEA', 'colonia'], ['Agar all\'acetato', 'ascospore di Saccharomyces']] },
    spor: { terreno: 'YPD o MEA', luce: 'non serve', temp: '25 °C', giorni: 'da 2 a 3 giorni',
      passi: ['Crescono e gemmano da soli in 2 o 3 giorni.', 'Per le ascospore di Saccharomyces usa agar all\'acetato di potassio a 25 °C per 3 a 7 giorni.'] },
    atlas: { url: `${AD}/fungal-descriptions-and-antifungal-susceptibility/yeast-like-fungi/rhodotorula`, img: [
      [ADI('ua_image_landscape/public/media/images/2021-09/rhodotorula.jpg?h=c4dd2c7b&itok=DM-mwcC8'), 'Colonia di R. mucilaginosa']] },
  },
};
for (const f of FUNGHI) Object.assign(f, COLTURA[f.g] || {});
// giro 45: le foto di riferimento stanno dentro l'app, nella cartella atlante, ridotte a 640 px: si vedono
// senza rete, nella prova e anche se i siti di origine cambiano indirizzo. L'indirizzo originale resta in i[4]
const atlanteSlug = (g) => g.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
for (const f of FUNGHI) (f.atlas?.img || []).forEach((i, k) => {
  const name = `${atlanteSlug(f.g)}-${k + 1}.jpg`;
  // eslint-disable-next-line no-undef
  i[4] = i[0]; i[0] = (typeof ATLANTE_DATA !== 'undefined' && ATLANTE_DATA[name]) || `atlante/${name}`;
});
// giro 46: le foto dei nostri isolati (endofiti del grano, Agritech 2023-24) vengono prima di quelle del web,
// come riferimento del genere. Stanno nella cartella isolati/, le stesse che usano i ceppi in micoteca.
// eslint-disable-next-line no-undef
const LAB = (code, cap) => { const p = `isolati/${code}.jpg`; return [(typeof ATLANTE_DATA !== 'undefined' && ATLANTE_DATA[p]) || p, cap, LAB_CREDIT, null, p]; };
const LABS = (code, cap) => [LAB(code, cap), LAB(`${code}_r`, `${cap}, retro`)];
// giro 49: tra le foto di riferimento vanno solo gli isolati con la specie confermata dal sequenziamento.
// Quelli in micoteca entrano da soli quando sono confermati (app.js, idGallery); qui restano gli isolati che
// in micoteca non ci sono, ognuno con specie e locus sequenziato, controllati con la stessa regola
const LABC = (code, cap, sp, ref) => { const x = LAB(code, cap); x[5] = { sp, ref }; return x; };
const LAB_FOTO = {
  Fusarium: [LABC('foto_graminearum', 'F. graminearum su PDA, grano duro di Ostia Antica (RM)', 'Fusarium graminearum', 'TEF1')],
  Rhizopus: [LABC('ID21_4', 'R. arrhizus su PDA, grano duro di Vizzini (CT)', 'Rhizopus arrhizus', 'ITS')],
  Aureobasidium: [LABC('ID36_9', 'A. pullulans su PDA, grano tenero di Rivisondoli (AQ)', 'Aureobasidium pullulans', 'ITS')],
};
for (const f of FUNGHI) if (LAB_FOTO[f.g]) f.atlas = { ...(f.atlas || {}), img: [...LAB_FOTO[f.g], ...(f.atlas?.img || [])] };

// ---- i disegnini delle spore e delle ife, per i bottoni della chiave
const sprSvg = (inner, vb = '0 0 48 32') => `<svg class="spr" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
export const SPORE_SVG = {
  falcate: sprSvg('<path d="M4 20 C12 29 34 28 44 11 C35 21 15 23 6 16 Z"/><path d="M13 21.6 L15 24.6 M20 22.6 L21.3 25.8 M27 22 L28 25.3 M34 19.2 L35.8 22.3"/><path d="M4 20 L3 23.5"/>'),
  lunate: sprSvg('<path d="M10 22 C18 28 33 25 39 12 C32 20 19 21 12 18 Z"/><path d="M24 22 L25 25.4"/>'),
  catene: sprSvg('<path d="M24 31 V19"/><circle cx="24" cy="15" r="4"/><g class="f"><circle cx="17" cy="11" r="1.8"/><circle cx="13.5" cy="8" r="1.8"/><circle cx="10" cy="5" r="1.8"/><circle cx="24" cy="8.5" r="1.8"/><circle cx="24" cy="4.5" r="1.8"/><circle cx="31" cy="11" r="1.8"/><circle cx="34.5" cy="8" r="1.8"/><circle cx="38" cy="5" r="1.8"/></g>'),
  rami: sprSvg('<path d="M10 30 L22 18"/><ellipse cx="25" cy="15" rx="4.5" ry="2.4" transform="rotate(-40 25 15)"/><ellipse cx="31" cy="11" rx="3.6" ry="2" transform="rotate(-25 31 11)"/><ellipse cx="38" cy="8" rx="3" ry="1.8" transform="rotate(-15 38 8)"/><ellipse cx="28" cy="7" rx="3" ry="1.7" transform="rotate(-70 28 7)"/><ellipse cx="22" cy="5" rx="2.6" ry="1.5" transform="rotate(-20 22 5)"/>'),
  muribecco: sprSvg('<path d="M8 25 C6 13 16 7 23 12 L42 6 L42.5 8 L25 15 C28 22 22 29 14 29 C11 29 9 27.5 8 25 Z"/><path d="M10 17 L22 14 M8.5 22 L25 19 M11 27 L24 24 M15 11 L16 28"/>'),
  muri: sprSvg('<rect x="12" y="7" width="24" height="18" rx="9"/><path d="M12 16 H36 M20 7.5 V24.5 M28 7.5 V24.5 M24 10 V22"/><path d="M24 25 V31"/>'),
  elmintosporio: sprSvg('<path d="M4 19 C10 9 34 7 44 13 C38 21 12 25 4 19 Z" class="f2"/><path d="M10 14 L11 21 M16 11.5 L17 21 M22 10.5 L23 20 M28 10.5 L29 19 M34 11.5 L35 17.5 M39.5 12 L40 16"/>'),
  cilindriche: sprSvg('<rect x="6" y="10" width="34" height="11" rx="5.5"/><rect x="14" y="23" width="24" height="7" rx="3.5" opacity=".6"/>'),
  grappolo: sprSvg('<path d="M24 31 V15 M24 15 L16 9 M24 15 L32 9 M24 15 V7" class="f2"/><g><ellipse cx="14" cy="6" rx="2.6" ry="1.9"/><ellipse cx="18" cy="5" rx="2.6" ry="1.9"/><ellipse cx="13" cy="10.5" rx="2.6" ry="1.9"/><ellipse cx="30" cy="5" rx="2.6" ry="1.9"/><ellipse cx="34" cy="6.5" rx="2.6" ry="1.9"/><ellipse cx="35" cy="10.5" rx="2.6" ry="1.9"/><ellipse cx="22" cy="3.6" rx="2.4" ry="1.8"/><ellipse cx="26" cy="3.6" rx="2.4" ry="1.8"/></g>'),
  teste: sprSvg('<path d="M24 31 V22 M24 22 L17 14 M24 22 L31 14 M24 22 V12"/><circle cx="15" cy="10" r="4.6"/><circle cx="33" cy="10" r="4.6"/><circle cx="24" cy="7" r="4.6"/><g class="f"><circle cx="14" cy="9" r="1"/><circle cx="16" cy="11.4" r="1"/><circle cx="32.4" cy="9" r="1"/><circle cx="34" cy="11" r="1"/><circle cx="23" cy="6" r="1"/><circle cx="25.4" cy="8" r="1"/></g>'),
  grandinere: sprSvg('<path d="M10 31 C14 27 18 25 20 24" /><path d="M20 24 C22 19 30 19 31 24 C32 29 21 29 20 24 Z"/><circle cx="27" cy="13" r="8" class="f"/>'),
  verrucose: sprSvg('<circle cx="24" cy="15" r="10" class="f2"/><path d="M14.5 15 H33.5 M24 5 V25 M17 8 L31 22"/><g class="f"><circle cx="15" cy="8" r="1.4"/><circle cx="33" cy="9" r="1.4"/><circle cx="34" cy="20" r="1.4"/><circle cx="14" cy="21" r="1.4"/><circle cx="24" cy="26.5" r="1.4"/></g><path d="M20 25 L18 31 L30 31 L28 25"/>'),
  diplodia: sprSvg('<ellipse cx="17" cy="16" rx="11" ry="7"/><ellipse cx="36" cy="16" rx="9" ry="6" class="f2"/><path d="M36 10 V22"/>'),
  picnidiospore: sprSvg('<path d="M8 30 C4 16 14 8 22 8 C30 8 40 16 36 30 Z" class="f2"/><path d="M20 8 V4 H24 V8"/><g><ellipse cx="30" cy="4" rx="1.6" ry="1"/><ellipse cx="34" cy="6" rx="1.6" ry="1"/><ellipse cx="37" cy="3" rx="1.6" ry="1"/><ellipse cx="40.5" cy="6.5" rx="1.6" ry="1"/><ellipse cx="43" cy="3.4" rx="1.6" ry="1"/></g>'),
  limoni: sprSvg('<path d="M4 16 C6 11 12 11 14 16 C12 21 6 21 4 16 Z M15 16 C17 11 23 11 25 16 C23 21 17 21 15 16 Z M26 16 C28 11 34 11 36 16 C34 21 28 21 26 16 Z M37 16 C39 11 44 11 46 16 C44 21 39 21 37 16 Z"/>'),
  sporangi: sprSvg('<path d="M24 31 V17"/><circle cx="24" cy="10" r="8.5"/><path d="M20 17 C20 12 28 12 28 17"/><g class="f"><circle cx="20" cy="6" r="1.1"/><circle cx="24" cy="4.5" r="1.1"/><circle cx="28" cy="6" r="1.1"/><circle cx="18.5" cy="10" r="1.1"/><circle cx="29.5" cy="10" r="1.1"/></g><path d="M24 31 C19 31 16 29 14 31 M24 31 C29 31 32 29 34 31"/>'),
  oomiceti: sprSvg('<path d="M2 28 H22 C26 28 26 22 22 22 L18 22" /><path d="M18 22 C12 21 10 13 14 8 C16 5 20 5 22 8 C26 13 24 21 18 22 Z"/><path d="M17.5 5.5 L18 3"/><circle cx="36" cy="17" r="8"/><circle cx="36" cy="17" r="5" class="f2"/>'),
  gemme: sprSvg('<ellipse cx="20" cy="17" rx="9" ry="7"/><ellipse cx="32" cy="10" rx="4.6" ry="3.6"/><ellipse cx="36" cy="23" rx="6" ry="4.6"/>'),
  nessuna: sprSvg('<path d="M2 18 H46"/><path d="M12 15 V21 M24 15 V21 M36 15 V21"/><path d="M30 18 L36 8"/>'),
};
export const IFE_SVG = {
  settate: sprSvg('<path d="M2 16 H46 M2 20 H46"/><path d="M14 16 V20 M28 16 V20 M40 16 V20"/>'),
  scure: sprSvg('<path d="M2 15 H46 V21 H2 Z" class="f2"/><path d="M14 15 V21 M28 15 V21 M40 15 V21"/>'),
  cenocitiche: sprSvg('<path d="M2 13 H46 M2 22 H46"/><path d="M26 13 C28 7 30 5 33 3 M33 3 L37 3"/>'),
  angolo: sprSvg('<path d="M2 20 H46 M2 25 H46"/><path d="M22 20 V4 M27 20 V4"/><path d="M22 15 C23.5 14 25.5 14 27 15 M22 9 H27"/>'),
  fibbie: sprSvg('<path d="M2 15 H46 M2 20 H46"/><path d="M24 15 V20"/><path d="M20 15 C20 8 29 8 28 15"/>'),
};

// ---- giro 44: le schede in gruppi, per sfogliarle in ordine
export const GRUPPI = [
  ['Spore chiare', ['Fusarium', 'Microdochium', 'Aspergillus', 'Penicillium', 'Trichoderma', 'Botrytis', 'Verticillium', 'Monilinia']],
  ['Spore scure', ['Alternaria', 'Stemphylium', 'Cladosporium', 'Epicoccum', 'Nigrospora', 'Bipolaris e Drechslera']],
  ['Picnidi e acervuli', ['Colletotrichum', 'Phoma e Didymella', 'Botryosphaeriaceae']],
  ['Senza spore in coltura', ['Sclerotinia', 'Rhizoctonia', 'Basidiomiceti del legno']],
  ['Mucorales', ['Rhizopus', 'Mucor']],
  ['Oomiceti', ['Phytophthora', 'Pythium']],
  ['Lieviti e simili', ['Aureobasidium', 'Lieviti']],
];

// ---- giro 44: i terreni e le condizioni citate nelle schede. k: la sigla come compare nei testi,
//      rx: come riconoscerla, cosa: la composizione in breve, uso: a cosa serve
export const TERRENI = [
  { g: 'Di base', k: 'PDA', n: 'Potato dextrose agar', rx: /\bPDA\b/, cosa: 'Infuso di patata (circa 200 g per litro) e destrosio al 2 %, con agar. In commercio c\'è la polvere pronta.', uso: 'Il terreno generale. Si guardano velocità, colore del micelio e del rovescio, e si conservano i ceppi. Molti funghi però ci sporulano poco o con spore deformate.' },
  { g: 'Di base', k: 'PSA', n: 'Potato sucrose agar', rx: /\bPSA\b/, cosa: 'Come la PDA, con saccarosio al posto del destrosio.', uso: 'Si usa come la PDA, per esempio per descrivere Microdochium.' },
  { g: 'Di base', k: 'MEA', n: 'Malt extract agar', rx: /\bMEA\b/, cosa: 'Estratto di malto al 2 %, spesso con glucosio e un po\' di peptone, con agar. Un po\' acido.', uso: 'Fa sporulare bene muffe e lieviti. È il terreno su cui si guardano teste di Aspergillus e penicilli.' },
  { g: 'Di base', k: 'WA', n: 'Agar acqua', rx: /\bWA\b|agar acqua/i, cosa: 'Solo agar all\'1,5 o 2 % in acqua.', uso: 'Per isolare da punta di ifa, per le anastomosi di Rhizoctonia e come base per CLA e aghi di pino. Senza zuccheri le ife restano rade e si vedono bene.' },
  // giro 47: i brodi che usiamo, subito dopo quelli di base
  { g: 'Brodi', k: 'PDB', n: 'Potato dextrose broth', rx: /\bPDB\b/, cosa: 'La PDA senza agar: infuso di patata e destrosio al 2 %. In commercio c\'è la polvere pronta.', uso: 'Il brodo generale. In beuta, ferma o in agitazione, dà micelio pulito per il DNA, per i metaboliti e per gli inoculi. In agitazione molti Fusarium fanno anche microconidi.' },
  { g: 'Brodi', k: 'MEB', n: 'Malt extract broth', rx: /\bMEB\b/, cosa: 'Estratto di malto al 2 % in acqua, a volte con glucosio e un po\' di peptone, senza agar.', uso: 'Micelio e metaboliti di Aspergillus, Penicillium e lieviti. È un po\' acido e frena i batteri.' },
  { g: 'Brodi', k: 'Fagiolo mung', n: 'Brodo di fagiolo mung', rx: /fagiol\w* mung|mung bean/i, cosa: 'Acqua di cottura dei fagioli mung, filtrata.', uso: 'Il brodo classico per i macroconidi di F. graminearum, da usare per inoculare le spighe.' },
  { g: 'Brodi', k: 'CMC', n: 'Brodo con carbossimetilcellulosa', rx: /\bCMC\b/, cosa: 'Carbossimetilcellulosa all\'1,5 % con nitrato di ammonio, fosfato, solfato di magnesio ed estratto di lievito.', uso: 'In agitazione F. graminearum fa molti macroconidi in 4 a 7 giorni, per gli inoculi.' },
  { g: 'Brodi', k: 'Czapek', n: 'Brodo Czapek Dox', rx: /\bCzapek\b/, cosa: 'Saccarosio e nitrato di sodio con sali, a composizione nota.', uso: 'Conidi di Verticillium per gli inoculi, e studi sul metabolismo.' },
  { g: 'Per far sporulare', k: 'SNA', n: 'Spezieller Nährstoffarmer Agar', rx: /\bSNA\b/, cosa: 'Terreno povero con sali (fosfato, nitrato e solfato di potassio e magnesio) e solo 0,2 g per litro di glucosio e di saccarosio. Spesso con un pezzetto di carta da filtro sterile.', uso: 'Fusarium e Cladosporium fanno microconidi, catene e clamidospore tipici. Con poco zucchero il fungo sporula invece di fare micelio.' },
  { g: 'Per far sporulare', k: 'CLA', n: 'Carnation leaf agar', rx: /\bCLA\b/, cosa: 'Pezzetti di foglia di garofano essiccati e sterilizzati appoggiati su agar acqua.', uso: 'Fusarium forma sugli sporodochi i macroconidi tipici, quelli su cui si basa la descrizione delle specie.' },
  { g: 'Per far sporulare', k: 'PCA', n: 'Potato carrot agar', rx: /\bPCA\b/, cosa: 'Infuso di patata e di carota, circa 20 g ciascuna per litro, con agar.', uso: 'Alternaria e Stemphylium fanno le catene di conidi tipiche, che si guardano nella piastra senza montare il vetrino.' },
  { g: 'Per far sporulare', k: 'V8', n: 'V8 juice agar', rx: /\bV8\b/, cosa: 'Succo di verdure V8 (circa 200 mL per litro) con carbonato di calcio e agar. Per gli oomiceti si chiarifica centrifugando il succo.', uso: 'Sporangi e oospore di Phytophthora, conidi di Alternaria, Bipolaris e Stemphylium.' },
  { g: 'Per far sporulare', k: 'OA', n: 'Oatmeal agar', rx: /\bOA\b|agar d'avena/i, cosa: 'Farina o fiocchi d\'avena (30 a 60 g per litro) con agar.', uso: 'Picnidi di Phoma e Didymella, acervuli di Colletotrichum, sporodochi di Epicoccum. I colori delle colonie sono più tipici.' },
  { g: 'Per far sporulare', k: 'CMA', n: 'Corn meal agar', rx: /\bCMA\b/, cosa: 'Infuso di farina di mais con agar, povero di zuccheri.', uso: 'Oogoni e oospore di Pythium, colonie di Phytophthora. Con fili d\'erba sterili fa nascere gli sporangi.' },
  { g: 'Per far sporulare', k: 'CMD', n: 'Corn meal dextrose agar', rx: /\bCMD\b/, cosa: 'CMA con destrosio al 2 %.', uso: 'Conidiofori e fialidi di Trichoderma.' },
  { g: 'Per far sporulare', k: 'Aghi di pino', n: 'Agar acqua con aghi di pino', rx: /aghi di pino/i, cosa: 'Aghi di pino autoclavati appoggiati su agar acqua al 2 %.', uso: 'Le Botryosphaeriaceae fanno i picnidi sugli aghi in 2 a 4 settimane.' },
  { g: 'Per far sporulare', k: 'NUV', n: 'Luce vicina all\'ultravioletto', rx: /\bNUV\b/, cosa: 'Lampade a luce nera (circa 320 a 400 nm), di solito 12 ore accese e 12 spente, insieme o in alternativa ai neon bianchi.', uso: 'Fa sporulare molti funghi che al buio fanno solo micelio, come Alternaria, Botrytis, Phoma e Fusarium.' },
  { g: 'Aspergillus e Penicillium', k: 'CYA', n: 'Czapek yeast autolysate agar', rx: /\bCYA\b/, cosa: 'Czapek (saccarosio 3 % e nitrato) con estratto di lievito, con agar.', uso: 'Il terreno di riferimento per Aspergillus e Penicillium. Si misura il diametro dopo 7 giorni a 25 °C, e a 30 e 37 °C.' },
  { g: 'Aspergillus e Penicillium', k: 'YES', n: 'Yeast extract sucrose agar', rx: /\bYES\b/, cosa: 'Estratto di lievito al 2 % e saccarosio al 15 %, con agar.', uso: 'Mette in evidenza pigmenti e metaboliti, micotossine comprese. Anche in brodo, senza agar, per far produrre le aflatossine ad A. flavus.' },
  { g: 'Aspergillus e Penicillium', k: 'CREA', n: 'Creatine sucrose agar', rx: /\bCREA\b/, cosa: 'Creatina e saccarosio con porpora di bromocresolo, viola.', uso: 'Le specie di Penicillium che producono acidi fanno virare il terreno al giallo.' },
  { g: 'Aspergillus e Penicillium', k: 'AFPA', n: 'Aspergillus flavus parasiticus agar', rx: /\bAFPA\b/, cosa: 'Estratto di lievito, peptone e citrato ferrico ammoniacale, con dicloran e cloramfenicolo.', uso: 'Le colonie della sezione Flavi (A. flavus, A. parasiticus) hanno il rovescio arancio in 2 o 3 giorni a 30 °C.' },
  { g: 'Aspergillus e Penicillium', k: 'DG18', n: 'Dichloran glycerol agar', rx: /\bDG18\b/, cosa: 'Glicerolo al 18 % e dicloran, con agar.', uso: 'Per i funghi xerofili (Eurotium, Wallemia) e gli alimenti secchi.' },
  { g: 'Oomiceti', k: 'PARP', n: 'Agar selettivo per oomiceti', rx: /\bPARPH?\b/, cosa: 'CMA con pimaricina, ampicillina, rifampicina e PCNB. PARPH ha anche l\'imexazolo.', uso: 'Per isolare Pythium e Phytophthora da piante e suolo. L\'imexazolo del PARPH ferma Pythium e lascia crescere Phytophthora.' },
  { g: 'Oomiceti', k: 'Segale', n: 'Agar di segale', rx: /segale/i, cosa: 'Estratto di semi di segale con saccarosio al 2 %, con agar.', uso: 'Il terreno di P. infestans, che a 18 °C ci fa gli sporangi.' },
  { g: 'Oomiceti', k: 'Estratto di terreno', n: 'Estratto di terreno non sterile', rx: /estratto di terreno/i, cosa: 'Acqua lasciata su terra di campo e filtrata, senza sterilizzarla.', uso: 'Coperti con l\'estratto, i dischetti di colonia di Phytophthora fanno gli sporangi in 1 a 3 giorni.' },
  { g: 'Lieviti', k: 'YPD', n: 'Yeast extract peptone dextrose', rx: /\bYPD\b/, cosa: 'Estratto di lievito 1 %, peptone 2 % e glucosio 2 %.', uso: 'Il terreno ricco per i lieviti.' },
  { g: 'Lieviti', k: 'Acetato', n: 'Agar all\'acetato di potassio', rx: /acetato/i, cosa: 'Acetato di potassio all\'1 %, poco estratto di lievito e glucosio, con agar.', uso: 'Fa sporulare Saccharomyces, le ascospore si vedono in 3 a 7 giorni.' },
];

// ---- giro 45: come si preparano i terreni e qualche idea per usarli. Ricette per un litro; le polveri
//      pronte si sciolgono come dice l'etichetta. Dove non è scritto, autoclave a 121 °C per 15 minuti
const PREP = {
  PDB: ['Dalla polvere pronta, di solito 24 g per litro. Fatto in casa, come la PDA senza agar. Da 50 a 100 mL per beuta da 250 mL.',
    'Si inocula con 3 o 4 tasselli di colonia o con una sospensione di spore. Dopo 5 a 7 giorni a 25 °C il micelio si raccoglie filtrando su garza o Miracloth, si asciuga su carta e si congela o si liofilizza per il DNA. In agitazione (120 a 150 giri al minuto) cresce più in fretta, a palline.'],
  MEB: ['Dalla polvere pronta seguendo l\'etichetta, oppure 20 g di estratto di malto per litro. Senza autoclavare troppo a lungo, perché gli zuccheri del malto scuriscono.',
    'Utile per i funghi che in PDB crescono poco e per le prove di crescita in liquido.'],
  'Fagiolo mung': ['40 g di fagioli mung bolliti 10 minuti in un litro d\'acqua, filtrati su garza e autoclavati.',
    'Si inoculano 3 o 4 tasselli da una colonia di una settimana, poi 3 a 7 giorni a 25 °C in agitazione. I macroconidi si filtrano su garza, si contano nella camera di Bürker e si diluiscono alla concentrazione voluta, di solito 10⁵ per mL.'],
  PDA: ['Dalla polvere pronta, di solito 39 g per litro. Fatta in casa, 200 g di patate a cubetti bollite 30 minuti in un litro d\'acqua, filtrate su garza, con 20 g di destrosio e 15 a 20 g di agar, riportando a un litro.',
    'A metà concentrazione le colonie restano più compatte e molti funghi sporulano di più. Con cloramfenicolo o streptomicina (50 a 100 mg per litro, aggiunti dopo l\'autoclave) si isola dai semi senza batteri.'],
  PSA: ['Come la PDA fatta in casa, con 20 g di saccarosio al posto del destrosio.',
    'Serve quando un protocollo o una descrizione di specie lo chiedono, per confrontare le colonie con quelle pubblicate.'],
  MEA: ['Dalla polvere pronta seguendo l\'etichetta. La ricetta classica ha 20 g di estratto di malto, 20 g di glucosio, 1 g di peptone e 20 g di agar. Senza autoclavare troppo a lungo, perché a pH acido l\'agar si ammorbidisce.',
    'Il terreno per i lieviti e per le muffe degli alimenti. Su MEA i conidi di Aspergillus e Penicillium mostrano bene il loro colore.'],
  WA: ['15 a 20 g di agar in un litro di acqua distillata. Piastre sottili.',
    'Per isolare da punta di ifa, appoggia il frammento di tessuto e dopo 1 o 2 giorni taglia la punta di un\'ifa isolata e spostala su PDA, così il fungo si separa dai batteri e dagli altri funghi. È anche la base per CLA, aghi di pino e fili d\'erba.'],
  SNA: ['KH₂PO₄ 1 g, KNO₃ 1 g, MgSO₄·7H₂O 0,5 g, KCl 0,5 g, glucosio 0,2 g, saccarosio 0,2 g e agar 20 g. Dopo aver versato si appoggia sulla superficie un quadratino sterile di carta da filtro di circa 1 cm.',
    'È trasparente, quindi conidiofori e catene si guardano allo stereo direttamente nella piastra. Va bene anche per tenere a breve i Fusarium senza che degenerino.'],
  CLA: ['Foglie fresche di garofano senza trattamenti, tagliate a pezzi di 3 a 5 mm, essiccate a 45 a 55 °C e sterilizzate (il manuale di Leslie e Summerell consiglia i raggi gamma; in autoclave funzionano un po\' meno). Se ne appoggiano 4 o 5 pezzi su agar acqua al 2 % già versato.',
    'Con i Fusarium dei cereali si usano anche pezzetti sterili di paglia o di foglia di grano. I pezzi di foglia si conservano secchi per mesi in un barattolo chiuso.'],
  PCA: ['20 g di patata e 20 g di carota pelate e grattugiate, bollite un\'ora in un litro d\'acqua, filtrate, con 20 g di agar e acqua fino a un litro. Niente zuccheri aggiunti.',
    'Con piastre sottili e luce le catene di Alternaria si contano direttamente allo stereo, senza toccarle e senza montare il vetrino.'],
  V8: ['200 mL di succo V8, 3 g di carbonato di calcio, 15 a 20 g di agar e acqua fino a un litro. Per gli oomiceti il succo con il carbonato si centrifuga e si usa solo il liquido limpido (V8 chiarificato).',
    'In Italia il V8 non si trova facilmente, si ordina online. Con un succo di verdure senza sale le colonie possono cambiare, conviene tenere una piastra di confronto.'],
  OA: ['30 a 60 g di fiocchi d\'avena lasciati un\'ora in acqua calda (o bolliti), filtrati su garza, con 15 a 20 g di agar. Esiste anche la polvere pronta.',
    'Su OA molti funghi fanno anche le strutture sessuate. Per Phoma e Didymella conta anche il colore che la colonia dà al terreno intorno.'],
  CMA: ['Dalla polvere pronta, di solito 17 g per litro. È povero di zuccheri e trasparente.',
    'Con semi di canapa bolliti o fili d\'erba sterili appoggiati sulla colonia si ottengono oogoni e sporangi di Pythium. Per le clamidospore dei lieviti si striscia sotto un vetrino.'],
  CMD: ['CMA con 20 g di destrosio per litro.',
    'Usato nelle descrizioni di Trichoderma per misurare la crescita a 25, 30 e 35 °C.'],
  'Aghi di pino': ['Aghi di pino tagliati a pezzi di 2 o 3 cm, autoclavati due volte a un giorno di distanza, appoggiati sull\'agar acqua.',
    'Con pezzetti sterili della pianta ospite (rametti, foglie) i picnidi somigliano di più a quelli che si trovano in natura.'],
  NUV: ['Lampade fluorescenti a luce nera (BLB) o LED a circa 365 nm, a 30 o 40 cm dalle piastre, con un timer per 12 ore accese e 12 spente. Il coperchio di plastica delle piastre lascia passare questa luce.',
    'L\'alternanza di luce e buio dà spesso anelli concentrici di spore, utili anche per le foto delle colonie.'],
  CYA: ['Czapek concentrato 10 mL, K₂HPO₄ 1 g, estratto di lievito 5 g, saccarosio 30 g, agar 15 g e la soluzione di metalli in tracce (zinco e rame).',
    'Si inocula in tre punti con una sospensione di spore, così si confrontano tre colonie uguali. A 37 °C separa A. fumigatus dalle specie vicine e molti Penicillium non crescono.'],
  YES: ['Estratto di lievito 20 g, saccarosio 150 g, MgSO₄·7H₂O 0,5 g, agar 20 g e i metalli in tracce.',
    'È il terreno da cui si estraggono le micotossine delle colonie, con qualche tassello di agar in solvente, per l\'LC-MS.'],
  CREA: ['Creatina 3 g, saccarosio 30 g, KCl 0,5 g, MgSO₄·7H₂O 0,5 g, FeSO₄·7H₂O 0,01 g, K₃PO₄ 1,6 g, porpora di bromocresolo 0,05 g e agar 15 g, secondo Frisvad.',
    'Il viraggio al giallo intorno alla colonia, e a volte il ritorno al viola, aiuta a separare specie di Penicillium che sulle altre piastre si somigliano.'],
  AFPA: ['Dalla polvere pronta con il supplemento di cloramfenicolo. Si incuba a 30 °C e si legge dopo 42 a 48 ore.',
    'Uno screening veloce di cariossidi e semi per il gruppo di A. flavus, prima di analizzare le aflatossine.'],
  DG18: ['Dalla polvere pronta, aggiungendo 220 g di glicerolo per litro prima dell\'autoclave.',
    'Per cereali, farine e semi secchi, dove le muffe xerofile restano nascoste sui terreni normali.'],
  PARP: ['CMA autoclavato e raffreddato a 50 °C, poi gli antibiotici sciolti a parte, per litro pimaricina 5 a 10 mg, ampicillina 250 mg, rifampicina 10 mg e PCNB 100 mg, più imexazolo 50 mg per il PARPH. Piastre al buio, da usare entro una settimana.',
    'Per Phytophthora nel suolo si usano le esche, foglie, petali o pezzi di mela in acqua sopra la terra, e dopo qualche giorno si piastrano i pezzi con le macchie.'],
  Segale: ['60 g di semi di segale in ammollo o bolliti un\'ora, filtrati, con 20 g di saccarosio e 15 g di agar per litro.',
    'P. infestans ci resta vitale più a lungo che su V8. A 18 °C sporula per settimane.'],
  'Estratto di terreno': ['Una parte di terra di campo e dieci di acqua, si lascia un giorno, poi si filtra o si centrifuga. Non si sterilizza, perché sono i microrganismi del suolo ad aiutare la formazione degli sporangi.',
    'Funziona anche l\'acqua di uno stagno o di un fiume filtrata.'],
  CMC: ['Carbossimetilcellulosa 15 g, NH₄NO₃ 1 g, KH₂PO₄ 1 g, MgSO₄·7H₂O 0,5 g ed estratto di lievito 1 g per litro, sciolti mescolando a lungo. In beute con poco liquido, per esempio 50 mL in una beuta da 250.',
    'Si inocula con tasselli di colonia da SNA e si agita a 150 o 180 giri al minuto. Dopo 4 a 7 giorni si filtra su garza e si contano i conidi in camera di Bürker.'],
  Czapek: ['Dalla polvere pronta, circa 35 g per litro (saccarosio 30 g, NaNO₃ 3 g, K₂HPO₄ 1 g, MgSO₄ 0,5 g, KCl 0,5 g, FeSO₄ 0,01 g).',
    'Essendo a composizione nota, si può cambiare solo lo zucchero o l\'azoto e vedere cosa cambia nei metaboliti prodotti.'],
  YPD: ['Estratto di lievito 10 g, peptone 20 g e glucosio 20 g per litro, con 20 g di agar per il solido. Il glucosio meglio autoclavato a parte.',
    'Il brodo YPD serve a far crescere i lieviti prima di estrarre il DNA.'],
  Acetato: ['Acetato di potassio 10 g, estratto di lievito 1 g, glucosio 0,5 g e agar 20 g per litro.',
    'Le ascospore si vedono meglio colorate con verde malachite e safranina.'],
};
for (const t of TERRENI) { const p = PREP[t.k]; if (p) { t.prep = p[0]; t.idee = p[1]; } }
// le regole che valgono per tutti i terreni
export const TERRENI_REGOLE = [
  'Si autoclava a 121 °C per 15 minuti in bottiglie riempite al massimo per due terzi. Bottiglie da un litro piene richiedono più tempo.',
  'Antibiotici, vitamine e zuccheri delicati si aggiungono dopo, quando il terreno è sceso a circa 50 °C, cioè quando la bottiglia si tiene in mano.',
  'Circa 20 mL per piastra da 9 cm, quindi 25 piastre da mezzo litro. Piastre sottili (10 o 12 mL) per guardare allo stereo e per sporulare.',
  'Le beute con il brodo si riempiono per un quinto, al massimo un terzo, e si chiudono con cotone o stagnola. Il fungo ha bisogno di aria, soprattutto in agitazione.',
  'Le piastre si asciugano un giorno capovolte e chiuse, poi si tengono in frigo al buio in sacchetti, segnando terreno e data. Si usano entro 2 a 4 settimane, quelle con antibiotici o colorate prima.',
  'Per le foto e i confronti conviene usare sempre lo stesso terreno, lo stesso spessore e la stessa età della colonia, e segnarli nella foto.',
];

// =====================================================================
//  Giro 46: le schede delle specie che abbiamo in micoteca o tra gli endofiti
//  del grano, con il nome di oggi, gli altri nomi, malattie, ospiti e tossine.
//  Nomi e numeri controllati su Index Fungorum, Species Fungorum e MycoBank
//  (ottobre 2026). n e a: nome e autore di oggi. k: altri nomi con cui la
//  specie può stare nei ceppi. syn: [nome, autore, che cos'è]. if e mb: i
//  numeri dei record (per un complesso, quelli della specie che gli dà il nome).
// =====================================================================
export const SPECIE = [
  { n: 'Fusarium graminearum', a: 'Schwabe', cx: 'Complesso F. sambucinum (FSAMSC), clade Graminearum',
    syn: [['Gibberella zeae', '(Schwein.) Petch', 'teleomorfo'], ['Gibberella saubinetii', '(Durieu & Mont.) Sacc.', 'vecchio nome del teleomorfo'], ['Fusarium roseum var. graminearum', '(Schwabe) W.C. Snyder & H.N. Hansen', 'nel sistema di Snyder e Hansen']],
    mal: 'Fusariosi della spiga di frumento, orzo e avena, marciume della spiga del mais. A volte marciume del colletto.', osp: 'Frumento, orzo, avena, mais, riso',
    tox: 'DON con 3-ADON o 15-ADON, oppure NIV. Zearalenone, culmorina.', nota: 'Con l\'ITS si confonde con F. culmorum. Il TEF1 porta al clade Graminearum, ma non sempre separa le specie sorelle come F. boothii.', if: 200256, mb: 200256 },
  { n: 'Fusarium culmorum', a: '(Wm.G. Sm.) Sacc.', cx: 'Complesso F. sambucinum (FSAMSC), clade Graminearum',
    syn: [['Fusisporium culmorum', 'Wm.G. Sm.', 'basionimo'], ['Fusarium rubiginosum', 'Appel & Wollenw.', 'sinonimo storico']],
    mal: 'Marciume del piede e delle radici, fusariosi della spiga, moria delle plantule.', osp: 'Frumento, orzo, avena, segale, mais e altre graminacee',
    tox: 'DON con 3-ADON oppure NIV. Zearalenone, culmorina.', nota: 'Con l\'ITS si confonde con F. graminearum, il TEF1 li separa. Il chemotipo si vede con una PCR sui geni TRI.', if: 196997, mb: 196997 },
  { n: 'Fusarium pseudograminearum', a: 'O\'Donnell & T. Aoki', cx: 'Complesso F. sambucinum (FSAMSC), clade Graminearum',
    syn: [['Gibberella coronicola', 'T. Aoki & O\'Donnell', 'teleomorfo'], ['Fusarium graminearum Gruppo 1', '', 'nome informale usato prima del 1999']],
    mal: 'Marciume del colletto dei cereali a paglia, a volte fusariosi della spiga.', osp: 'Frumento, orzo, avena e altre graminacee. Segnalato in Italia',
    tox: 'DON con 15-ADON o 3-ADON, raramente NIV.', nota: 'Al microscopio è quasi uguale a F. graminearum. Si separa con il TEF1.', if: 460635, mb: 460635 },
  { n: 'Fusarium avenaceum', a: '(Fr.) Sacc.', cx: 'Complesso F. tricinctum (FTSC)',
    syn: [['Gibberella avenacea', 'R.J. Cook', 'teleomorfo'], ['Fusisporium avenaceum', 'Fr.', 'basionimo'], ['Fusarium roseum var. avenaceum', '(Fr.) W.C. Snyder & H.N. Hansen', 'nel sistema di Snyder e Hansen']],
    mal: 'Fusariosi della spiga di frumento e orzo. È la specie del suo gruppo più comune in Italia.', osp: 'Frumento, orzo e altri cereali, leguminose, molti altri ospiti',
    tox: 'Enniatine e moniliformina, anche aurofusarina.', nota: 'Con l\'ITS si confonde con F. tricinctum. Con il solo TEF1 non sempre è ben risolto, aiuta RPB1.', if: 161610, mb: 161610 },
  { n: 'Fusarium proliferatum', a: '(Matsush.) Nirenberg ex Gerlach & Nirenberg', cx: 'Complesso F. fujikuroi (FFSC)',
    syn: [['Cephalosporium proliferatum', 'Matsush.', 'basionimo'], ['Gibberella fujikuroi popolazione D', '', 'teleomorfo nello schema delle popolazioni di incrocio']],
    mal: 'Marciume della spiga del mais, bakanae del riso. Porta fumonisine anche nelle cariossidi di frumento, soprattutto al Sud.', osp: 'Mais, frumento, orzo, riso e molte altre piante',
    tox: 'Fumonisine FB1, FB2 e FB3, beauvericina, moniliformina.', nota: 'Nel complesso FFSC l\'ITS porta fuori strada. Usa il TEF1, con la calmodulina se serve.', if: 509381, mb: 509381 },
  { n: 'Fusarium fujikuroi species complex', k: ['FFSC', 'Fusarium fujikuroi'], eg: 'F. fujikuroi', cx: 'Complesso F. fujikuroi (FFSC), un tempo complesso Gibberella fujikuroi',
    syn: [['Fusarium moniliforme', 'J. Sheld.', 'vecchio nome di F. verticillioides'], ['Gibberella fujikuroi', '(Sawada) S. Ito', 'teleomorfo di F. fujikuroi'], ['Gibberella moniliformis', 'Wineland', 'teleomorfo di F. verticillioides']],
    mal: 'Marciume della spiga del mais, bakanae del riso, fumonisine anche su frumento.', osp: 'Mais, riso, frumento e molte altre piante',
    tox: 'Fumonisine, gibberelline, beauvericina, moniliformina. Cambia da specie a specie.', nota: 'Più di 60 specie. L\'ITS non va usato, per la specie serve il TEF1 e poi RPB1 o RPB2.', if: 314213, mb: 314213 },
  { n: 'Fusarium incarnatum-equiseti species complex', k: ['FIESC'], eg: 'F. equiseti', cx: 'Complesso F. incarnatum-equiseti (FIESC), cladi Equiseti e Incarnatum',
    syn: [['Gibberella intricans', 'Wollenw.', 'teleomorfo di F. equiseti'], ['Fusarium semitectum', 'Berk. & Ravenel', 'vecchio nome di F. incarnatum'], ['Fusarium pallidoroseum', '(Cooke) Sacc.', 'sinonimo di F. incarnatum per MycoBank']],
    mal: 'Associato a malattie di molte colture, cereali compresi, con aggressività moderata.', osp: 'Cereali, molte altre colture, suolo',
    tox: 'Tricoteceni, zearalenone, beauvericina, enniatine, equisetina. Cambia da specie a specie.', nota: 'Più di 30 specie criptiche. Per la specie servono TEF1, calmodulina e RPB2.', if: 199819, mb: 199819 },
  { n: 'Fusarium sporotrichioides', a: 'Sherb.', cx: 'Complesso F. sambucinum (FSAMSC), clade Sporotrichioides',
    syn: [['Fusarium sporotrichiella', 'Bilaĭ', 'sinonimo storico']],
    mal: 'Fusariosi della spiga, come invasore secondario poco aggressivo.', osp: 'Cereali a paglia',
    tox: 'T-2, HT-2, DAS e NEO. Beauvericina in molti ceppi.', nota: 'Con l\'ITS si confonde con F. langsethiae e F. poae, il TEF1 li separa. Su PDA cresce più in fretta di F. langsethiae e fa colonie rosse.', if: 145064, mb: 145064 },
  { n: 'Fusarium oxysporum', a: 'Schltdl.', cx: 'Complesso F. oxysporum (FOSC)',
    syn: [['Fusarium orthoceras', 'Appel & Wollenw.', 'sinonimo storico'], ['Fusarium vasinfectum', 'G.F. Atk.', 'sinonimo storico'], ['F. oxysporum f. sp.', '', 'le formae speciales sono varianti patogene, non specie']],
    mal: 'Tracheofusariosi su molte colture. Molti ceppi del suolo non sono patogeni.', osp: 'Moltissime colture, con ceppi specializzati per ospite. Comune nel suolo',
    tox: 'Acido fusarico, beauvericina, enniatine.', nota: 'Il TEF1 arriva al complesso, non alla forma specialis. Quella si stabilisce con le prove di patogenicità.', if: 218372, mb: 218372 },
  { n: 'Fusarium langsethiae', a: 'Torp & Nirenberg', cx: 'Complesso F. sambucinum (FSAMSC), clade Sporotrichioides',
    syn: [['Fusarium poae', '', 'il nome dato per errore a questi ceppi prima del 2004']],
    mal: 'Patogeno debole di avena e orzo, ma la prima fonte di T-2 e HT-2 nei cereali in Europa. Segnalato in Italia.', osp: 'Avena, orzo, frumento',
    tox: 'T-2, HT-2, DAS e NEO. Beauvericina quasi mai.', nota: 'Nessun cambio di nome. Il TEF1 lo separa da F. poae e F. sporotrichioides.', if: 367398, mb: 367398 },
  { n: 'Fusarium poae', a: '(Peck) Wollenw.', cx: 'Complesso F. sambucinum (FSAMSC), clade Sambucinum',
    syn: [['Sporotrichum poae', 'Peck', 'basionimo'], ['Fusarium tricinctum f. poae', '(Peck) W.C. Snyder & H.N. Hansen', 'nel sistema di Snyder e Hansen']],
    mal: 'Fusariosi della spiga, come patogeno debole.', osp: 'Frumento, orzo, avena, mais e molte graminacee',
    tox: 'NIV, DAS, beauvericina, fusarina C. La T-2 non la fa.', nota: 'Si confonde con F. langsethiae, che però fa T-2 e HT-2. F. poae cresce in fretta e ha molti microconidi tondi.', if: 119380, mb: 119380 },
  { n: 'Fusarium iranicum', a: 'Torbati, Arzanlou & Sand.-Den.', cx: 'Complesso F. tricinctum (FTSC)', syn: [],
    mal: 'Descritto su Agaricus bisporus in Iran. In Italia un solo isolato da grano duro, in Abruzzo.', osp: 'Agaricus bisporus, grano duro',
    tox: 'Enniatine nell\'unico ceppo italiano saggiato.', nota: 'Specie rara. Il TEF1 la risolve, meglio insieme a RPB1.', if: 825229, mb: 825229 },
  { n: 'Fusarium robustum', a: 'Gerlach', cx: 'Complesso F. sambucinum (FSAMSC), clade Sambucinum', syn: [],
    mal: 'Descritto su Araucaria in Argentina. Sul grano nessuna malattia nota.', osp: 'Araucaria angustifolia, frumento, suolo',
    tox: '', nota: 'Specie rarissima, nota quasi solo dal ceppo tipo. Un isolato da grano va confermato con TEF1 e RPB1 o RPB2.', if: 314220, mb: 314220 },
  { n: 'Microdochium nivale', a: '(Fr.) Samuels & I.C. Hallett', k: ['Microdochium majus'], cx: 'Microdochiaceae, non è un Fusarium',
    syn: [['Fusarium nivale', '(Fr.) Sorauer', 'il vecchio nome'], ['Monographella nivalis', '(Schaffnit) E. Müll.', 'teleomorfo'], ['Gerlachia nivalis', '(Ces. ex Berl. & Voglino) W. Gams & E. Müll.', 'vecchio nome'], ['Microdochium majus', '(Wollenw.) Glynn & S.G. Edwards', 'specie sorella, un tempo varietà']],
    mal: 'Muffa rosata delle nevi, moria delle plantule da seme, marciumi del piede e della spiga.', osp: 'Frumento, segale, orzo, graminacee da tappeto erboso',
    tox: 'Nessuna micotossina regolamentata nota.', nota: 'Con l\'ITS M. nivale e M. majus si separano male, con TEF1, RPB2 o TUB2 sì.', if: 108213, mb: 108213 },
  { n: 'Microdochium novae-zelandiae', a: 'Hern.-Restr., Thangavel & Crous', cx: 'Microdochiaceae', syn: [],
    mal: 'Nessuna malattia nota.', osp: 'Tappeto erboso (Agrostis) in Nuova Zelanda', tox: '',
    nota: 'Nota solo dal ceppo tipo. Un nome da ITS su grano va confermato con RPB2 e TUB2.', if: 824606, mb: 824606 },
  { n: 'Alternaria alternata', a: '(Fr.) Keissl.', t: 'Alternaria sez. Alternaria', k: ['Alternaria sect. Alternaria', 'Alternaria sez. Alternaria', 'Alternaria tenuissima', 'Alternaria destruens', 'Alternaria alstroemeriae', 'Alternaria arborescens', 'Alternaria doliconidium'],
    cx: 'Alternaria sezione Alternaria, Pleosporaceae',
    syn: [['Alternaria tenuis', 'Nees', 'vecchio nome molto usato'], ['Alternaria tenuissima', '(Kunze) Wiltshire', 'sinonimo dal 2015'], ['Alternaria destruens', 'E.G. Simmons', 'sinonimo dal 2015'], ['Alternaria mali', 'Roberts', 'sinonimo dal 2015']],
    mal: 'Macchie fogliari e marciumi su molte colture, punta nera del grano. Alcuni patotipi hanno tossine specifiche per melo, fragola e agrumi.', osp: 'Polifaga. Cariossidi, frutta, ortaggi, suolo',
    tox: 'AOH, AME, TeA, ALT, ATX, TEN.', nota: 'L\'ITS non separa le specie della sezione. A. alstroemeriae e A. burnsii restano specie a parte, A. arborescens e A. cerealis stanno in un loro complesso. Servono GAPDH, RPB2 e Alt a 1.', if: 119834, mb: 119834 },
  { n: 'Alternaria infectoria', a: 'E.G. Simmons', t: 'Alternaria sez. Infectoriae', k: ['Alternaria sect. Infectoriae', 'Alternaria sez. Infectoriae', 'Alternaria hordeicola', 'Alternaria slovaca', 'Alternaria oregonensis', 'Alternaria forlicesenensis', 'Alternaria murispora'],
    cx: 'Alternaria sezione Infectoriae, Pleosporaceae',
    syn: [['Lewia infectoria', '(Fuckel) M.E. Barr & E.G. Simmons', 'teleomorfo'], ['Pleospora infectoria', 'Fuckel', 'nome originale del teleomorfo']],
    mal: 'Endofita e saprofita delle cariossidi, legata alla punta nera ma poco patogena.', osp: 'Cariossidi e paglia di frumento, orzo e altri cereali',
    tox: 'Di solito niente AOH, AME e TeA. Infectopironi e novae-zelandine.', nota: 'A. hordeicola, A. slovaca, A. oregonensis, A. forlicesenensis e A. murispora stanno qui e con l\'ITS non si separano. Scrivi sez. Infectoriae, a meno di GAPDH, RPB2 o ATPasi.', if: 103987, mb: 103987 },
  { n: 'Stemphylium botryosum', a: 'Wallr.', cx: 'Pleosporaceae, specie tipo del genere',
    syn: [['Pleospora tarda', 'E.G. Simmons', 'teleomorfo'], ['Macrosporium commune', 'Rabenh.', 'vecchio nome']],
    mal: 'Maculature fogliari su erba medica, trifoglio, lattuga e barbabietola.', osp: 'Leguminose foraggere, lattuga, barbabietola, granella',
    tox: 'Stemfipirone, stemfolo in alcuni ceppi. Niente AOH, ALT e TeA.', nota: 'L\'ITS riconosce molte specie del genere ma non tutte. Per i gruppi vicini servono GAPDH e calmodulina.', if: 218021, mb: 218021 },
  { n: 'Stemphylium eturmiunum', a: 'E.G. Simmons', cx: 'Pleosporaceae',
    syn: [['Pleospora eturmiuna', 'E.G. Simmons', 'teleomorfo'], ['Stemphylium capsici', 'Yong Wang bis & X.G. Zhang', 'sinonimo dal 2017']],
    mal: 'Patogenicità poco documentata.', osp: 'Pomodoro, peperone, aglio, granella',
    tox: 'Stemfipirone, come tutto il genere.', nota: 'Si confonde con S. vesicarium. Servono GAPDH e calmodulina.', if: 484336, mb: 484336 },
  { n: 'Stemphylium vesicarium', a: '(Wallr.) E.G. Simmons', k: ['Stemphylium herbarum', 'Pleospora herbarum'], cx: 'Pleosporaceae',
    syn: [['Pleospora herbarum', '(Pers.) Rabenh. ex Ces. & De Not.', 'teleomorfo, sinonimo dal 2017'], ['Stemphylium herbarum', 'E.G. Simmons', 'sinonimo dal 2017']],
    mal: 'Maculatura bruna del pero, macchie porpora dell\'asparago, macchie fogliari su varie colture.', osp: 'Pero, asparago, aglio, erba medica, residui e granella',
    tox: 'SV-tossine sul pero, stemfolo, macrosporina. Niente AOH e TeA.', nota: 'Dal 2017 un risultato S. herbarum o Pleospora herbarum va letto come S. vesicarium.', if: 339660, mb: 339660 },
  { n: 'Epicoccum nigrum', a: 'Link', k: ['Epicoccum purpurascens'], cx: 'Didymellaceae',
    syn: [['Epicoccum purpurascens', 'Ehrenb. ex Schltdl.', 'sinonimo molto usato'], ['Phoma epicoccina', 'Punith., M.C. Tulloch & C.M. Leach', 'la forma con i picnidi']],
    mal: 'Endofita e saprofita, studiato come agente di biocontrollo.', osp: 'Aria, suolo, piante, cariossidi',
    tox: 'Nessuna micotossina regolamentata. Pigmenti come l\'epicocconone.', nota: 'Per la specie servono rpb2 e tub2 oltre all\'ITS.', if: 226758, mb: 226758 },
  { n: 'Epicoccum italicum', a: 'Qian Chen, Crous & L. Cai', cx: 'Didymellaceae', syn: [],
    mal: 'Nessuna malattia nota.', osp: 'Plantule in Italia (il tipo), radici in Egitto', tox: '',
    nota: 'Descritta nel 2017 e poco studiata. Un nome da ITS va confermato con rpb2 e tub2.', if: 818965, mb: 818965 },
  { n: 'Cladosporium herbarum', a: '(Pers.) Link', cx: 'Complesso C. herbarum, Cladosporiaceae', k: ['Cladosporium angustiherbarum'],
    syn: [['Davidiella tassiana', '(De Not.) Crous & U. Braun', 'teleomorfo'], ['Mycosphaerella tassiana', '(De Not.) Johanson', 'vecchio nome del teleomorfo']],
    mal: 'Saprofita ed endofita ovunque, non è un patogeno importante. Il genere dà allergie.', osp: 'Residui vegetali, foglie, cariossidi, aria',
    tox: 'Nessuna micotossina regolamentata.', nota: 'L\'ITS non separa le specie dei complessi, servono actina e TEF1. C. angustiherbarum sta in questo complesso.', if: 231458, mb: 231458 },
  { n: 'Cladosporium cladosporioides', a: '(Fresen.) G.A. de Vries', cx: 'Complesso C. cladosporioides, Cladosporiaceae', k: ['Cladosporium chasmanthicola'],
    syn: [['Penicillium cladosporioides', 'Fresen.', 'basionimo'], ['Hormodendrum cladosporioides', '(Fresen.) Sacc.', 'vecchio nome']],
    mal: 'Saprofita ed endofita ovunque.', osp: 'Residui vegetali, foglie, cariossidi, aria',
    tox: 'Nessuna micotossina regolamentata. Cladosporina.', nota: 'Molte specie criptiche, l\'ITS non basta, servono actina e TEF1. C. chasmanthicola sta in questo complesso.', if: 294915, mb: 294915 },
  { n: 'Pyrenophora avenae', a: 'S. Ito & Kurib.', k: ['Drechslera avenae', 'Pyrenophora chaetomioides'], cx: 'Pleosporaceae',
    syn: [['Drechslera avenae', '(Eidam) Scharif', 'anamorfo'], ['Helminthosporium avenae', 'Eidam', 'il nome originale'], ['Pyrenophora chaetomioides', 'Speg.', 'il nome usato in molti lavori recenti']],
    mal: 'Elmintosporiosi dell\'avena, macchie fogliari e moria delle plantule.', osp: 'Avena, viaggia con il seme', tox: '',
    nota: 'Vicina a P. avenicola, sempre da avena. Per separarle servono gapdh e rpb2.', if: 258019, mb: 258019 },
  { n: 'Pyrenophora tritici-repentis', a: '(Died.) Drechsler', k: ['Drechslera tritici-repentis'], cx: 'Pleosporaceae',
    syn: [['Drechslera tritici-repentis', '(Died.) Shoemaker', 'anamorfo'], ['Helminthosporium tritici-repentis', 'Died.', 'vecchio nome']],
    mal: 'Maculatura gialla del frumento (tan spot).', osp: 'Frumento', tox: 'Ptr ToxA, ToxB e ToxC, che definiscono le razze.',
    nota: 'Il patogeno vero del genere sul grano. Se ne trovi uno, confermalo con gapdh e rpb2 e cerca i geni ToxA e ToxB.', if: 255190, mb: 255190 },
  { n: 'Pyrenophora nisikadoi', a: 'Y. Marín & Crous', cx: 'Pleosporaceae',
    syn: [['Helminthosporium brizae', 'Y. Nisik.', 'il nome sostituito'], ['Drechslera brizae', '(Y. Nisik.) Subram. & B.L. Jain', 'vecchio nome']],
    mal: 'Nessuna malattia importante documentata.', osp: 'Briza minor in Giappone e Nuova Zelanda', tox: '',
    nota: 'Specie poco nota. Un nome da ITS va confermato con gapdh e rpb2.', if: 829616, mb: 829616 },
  { n: 'Curvularia buchloes', a: '(Lefebvre & Aar.G. Johnson) Manamgoda, Rossman & K.D. Hyde', cx: 'Pleosporaceae',
    syn: [['Helminthosporium buchloës', 'Lefebvre & Aar.G. Johnson', 'basionimo'], ['Bipolaris buchloës', '(Lefebvre & Aar.G. Johnson) Shoemaker', 'vecchio nome']],
    mal: 'Nessuna malattia del grano nota.', osp: 'Buchloe dactyloides negli Stati Uniti', tox: '',
    nota: 'Nota solo dall\'erba bufalo, su grano il nome da ITS è poco probabile. Serve GAPDH.', if: 622507, mb: 622507 },
  { n: 'Chaetomium globosum', a: 'Kunze', k: ['Chaetomium globosum species complex', 'Chaetomium subglobosum'], cx: 'Complesso C. globosum, Chaetomiaceae',
    syn: [['Chaetomium subglobosum', 'Sergeeva', 'specie a parte per Wang et al. 2016, sinonimo per Index Fungorum e MycoBank']],
    mal: 'Saprofita che degrada la cellulosa ed endofita, non patogeno delle piante.', osp: 'Paglia e residui, carta, suolo, aria',
    tox: 'Chetoglobosine.', nota: 'ITS e LSU non risolvono il complesso, servono tub2 e rpb2.', if: 172545, mb: 172545 },
  { n: 'Aspergillus flavus', a: 'Link', k: ['Aspergillus oryzae', 'Aspergillus sect. Flavi', 'Aspergillus sez. Flavi'], cx: 'Aspergillus sezione Flavi',
    syn: [['Aspergillus oryzae', '(Ahlb.) Cohn', 'forma domesticata, sinonimo per Index Fungorum ma non per MycoBank']],
    mal: 'Aflatossine nella granella, in campo e in magazzino. Aspergillosi nell\'uomo.', osp: 'Mais, cereali, arachidi, frutta secca, suolo',
    tox: 'Aflatossine B1 e B2, acido ciclopiazonico, acido kojico.', nota: 'ITS, BenA e CaM non separano A. flavus da A. oryzae. Un isolato di campo si tratta come A. flavus finché un test delle aflatossine non dice il contrario.', if: 209842, mb: 209842 },
  { n: 'Aureobasidium pullulans', a: '(de Bary & Löwenthal) G. Arnaud', k: ['Aureobasidium namibiae'], cx: 'Saccotheciaceae, lievito nero',
    syn: [['Dematium pullulans', 'de Bary & Löwenthal', 'basionimo'], ['Pullularia pullulans', '(de Bary & Löwenthal) Berkhout', 'vecchio nome'], ['Aureobasidium namibiae', '(Zalar, de Hoog & Gunde-Cim.) Zalar, Gostinčar & Gunde-Cim.', 'prima varietà, specie a parte dal 2014']],
    mal: 'Epifita ed endofita, non patogeno. I ceppi DSM 14940 e 14941 sono un biocontrollo autorizzato nella UE.', osp: 'Foglie e frutti, uva, ambienti umidi',
    tox: 'Nessuna micotossina. Pullulano, aureobasidina A.', nota: 'L\'ITS non basta a separarla dalle specie vicine. Meglio GPD, TEF1 o RPB2.', if: 101771, mb: 101771 },
  { n: 'Rhizopus arrhizus', a: 'A. Fisch.', k: ['Rhizopus oryzae'], cx: 'Mucorales',
    syn: [['Rhizopus oryzae', 'Went & Prins. Geerl.', 'nome molto usato'], ['Rhizopus delemar', 'Boidin ex Wehmer & Hanzawa', 'oggi R. arrhizus var. delemar']],
    mal: 'Saprofita veloce, contaminante comune. Nell\'uomo causa mucormicosi.', osp: 'Materiale vegetale, alimenti, tempeh',
    tox: 'Nessuna micotossina nota.', nota: 'Cresce bene a 40 °C ma non a 45 °C.', if: 167790, mb: 167790 },
  { n: 'Trametes versicolor', a: '(L.) Lloyd', cx: 'Polyporaceae, Basidiomycota',
    syn: [['Coriolus versicolor', '(L.) Quél.', 'vecchio nome'], ['Polyporus versicolor', '(L.) Fr.', 'vecchio nome']],
    mal: 'Carie bianca del legno.', osp: 'Legno, soprattutto morto', tox: 'Nessuna. Polisaccaridi PSK e PSP, laccasi.',
    nota: 'L\'ITS basta per la specie.', if: 281625, mb: 281625 },
  { n: 'Pleurotus eryngii var. ferulae', a: '(Lanzi) Sacc.', cx: 'Complesso P. eryngii, Pleurotaceae',
    syn: [['Agaricus ferulae', 'Lanzi', 'basionimo'], ['Pleurotus ferulae', '', 'il nome a rango di specie usato in letteratura']],
    mal: 'Vive sulle radici di Ferula communis. Commestibile.', osp: 'Ferula communis', tox: 'Nessuna.',
    nota: 'Le varietà di P. eryngii si riconoscono soprattutto dalla pianta ospite, ITS e IGS1 le separano. Index Fungorum la mette in sinonimia con P. eryngii, MycoBank la tiene come varietà.', if: 171113, mb: 171113 },
  { n: 'Pleurotus eryngii var. elaeoselini', a: 'Venturella, Zervakis & La Rocca', cx: 'Complesso P. eryngii, Pleurotaceae', syn: [],
    mal: 'Vive sulle radici di Elaeoselinum asclepium. Commestibile.', osp: 'Elaeoselinum asclepium, Sicilia', tox: 'Nessuna.',
    nota: 'Si riconosce soprattutto dalla pianta ospite, ITS e IGS1 la separano. Index Fungorum la mette in sinonimia con P. eryngii, MycoBank la tiene come varietà.', if: 466259, mb: 466259 },
  { n: 'Phytophthora infestans', a: '(Mont.) de Bary', cx: 'Oomycota, non è un fungo',
    syn: [['Botrytis infestans', 'Mont.', 'basionimo'], ['Peronospora infestans', '(Mont.) Casp.', 'vecchio nome']],
    mal: 'Peronospora della patata e del pomodoro.', osp: 'Patata, pomodoro', tox: 'Nessuna.', nota: 'Per gli oomiceti i barcode sono ITS e COI.', if: 232148, mb: 232148 },
  { n: 'Phytophthora nicotianae', a: 'Breda de Haan', k: ['Phytophthora parasitica'], cx: 'Oomycota, non è un fungo',
    syn: [['Phytophthora parasitica', 'Dastur', 'sinonimo molto usato']],
    mal: 'Marciume nero del tabacco, marciumi del colletto e delle radici, moria delle piantine.', osp: 'Tabacco, pomodoro e molte altre piante', tox: 'Nessuna.',
    nota: 'Per gli oomiceti i barcode sono ITS e COI.', if: 194443, mb: 194443 },
];
// dove controllare i nomi: i siti che servono davvero, in ordine
export const SITI_NOMI = [
  ['Species Fungorum', 'https://www.speciesfungorum.org', 'nome di oggi e sinonimi'],
  ['MycoBank', 'https://www.mycobank.org', 'numero MB e sinonimi, i nomi nuovi nascono qui'],
  ['Fusarioid-ID', 'https://www.fusarium.org', 'BLAST curato per Fusarium e i generi vicini, con TEF1, RPB1 e RPB2'],
  ['EPPO Global Database', 'https://gd.eppo.int', 'nomi, ospiti e stato regolamentare dei patogeni'],
  ['Westerdijk (CBS)', 'https://wi.knaw.nl', 'i ceppi tipo con cui confrontare un isolato'],
];

// =====================================================================
//  Giro 47: la carta dell'Italia e dei paesi vicini per la mappa dei ceppi.
//  Confini da Natural Earth (world-atlas 2.0.2, pubblico dominio), semplificati.
//  Proiezione equirettangolare: x = (lon - lon0) * c * k, y = (lat0 - lat) * k
// =====================================================================
export const MAPPA = {"lon0":5.6,"lat0":47.3,"k":100,"c":0.74896,"w":1019,"h":1190,"land":"M442 1412L438 1452L438 1466L444 1478L445 1483L442 1489L391 1522L387 1528L375 1537L370 1550L365 1556L352 1559L350 1562L338 1584L349 1636L349 1643L346 1652L322 1691L294 1707L258 1523L256 1520L205 1476L202 1460L195 1437L188 1424L185 1421L162 1407L160 1403L158 1394L145 1358L142 1347L143 1322L161 1305L168 1289L189 1274L198 1257L203 1221L209 1210L204 1190L204 1165L198 1150L203 1111L206 1093L202 1085L195 1081L195 1078L207 1067L213 1054L225 1047L223 1036L241 1030L265 1011L306 996L317 999L313 1009L317 1016L322 1012L320 1005L336 1005L344 1009L344 1027L355 1044L352 1052L360 1057L368 1051L372 1042L387 1037L401 1024L408 1023L414 1043L409 1046L402 1056L389 1081L378 1088L369 1098L365 1112L367 1127L374 1141L381 1150L388 1153L405 1167L408 1196L413 1206L394 1242L381 1262L370 1275L338 1302L332 1316L333 1324L341 1345L352 1357L363 1364L383 1361L384 1379L397 1377L401 1367L411 1374L416 1393L424 1399L425 1401L420 1405L430 1409L434 1408L442 1412ZM425 1255L414 1262L416 1255L424 1248L425 1250L425 1255ZM294 -22L301 -17L300 -9L291 13L291 24L301 24L318 29L320 36L339 45L343 44L356 31L361 34L364 40L359 64L362 68L362 75L350 73L344 68L336 70L332 82L338 94L341 105L339 106L333 106L325 94L314 95L303 100L294 99L291 95L287 82L277 80L274 82L273 101L255 128L258 142L256 145L251 147L248 144L246 138L238 130L241 122L228 119L214 105L212 102L212 87L208 85L187 103L186 104L189 114L179 128L169 135L164 138L145 132L129 139L115 142L106 137L101 128L88 114L91 102L87 88L73 86L62 87L54 91L47 97L47 98L50 105L45 111L36 115L28 115L28 109L37 102L39 92L35 87L42 69L61 55L64 35L80 27L101 3L105 -4L99 -6L97 -9L102 -15L109 -19L115 -19L120 -13L130 -13L136 -16L142 -25L151 -29L157 -27L174 -26L187 -28L195 -31L212 -29L222 -32L221 -36L214 -35L211 -36L210 -39L212 -43L223 -48L234 -40L239 -42L242 -40L246 -36L268 -37L294 -22ZM817 80L803 77L797 82L798 91L796 93L784 93L779 99L774 102L752 110L748 116L749 119L754 125L753 144L751 147L738 150L725 157L731 165L726 169L725 172L729 183L722 186L712 185L701 180L693 183L689 182L678 173L672 164L669 165L661 179L657 182L635 182L628 179L624 185L620 187L600 182L597 178L608 171L612 172L620 169L616 162L604 151L598 149L597 147L600 134L599 132L592 133L590 129L591 126L600 117L602 112L588 108L586 109L583 104L584 98L590 93L605 84L607 78L670 90L686 80L696 69L720 66L737 67L745 65L751 60L761 59L776 62L777 59L777 50L786 44L800 44L804 58L808 62L808 66L817 80ZM1281 306L1275 311L1273 322L1260 329L1256 344L1256 352L1266 378L1270 385L1286 395L1293 405L1301 411L1299 420L1281 442L1270 442L1263 446L1261 451L1263 455L1261 467L1264 476L1268 482L1268 486L1260 497L1254 499L1246 494L1232 499L1221 498L1209 503L1196 505L1192 497L1199 491L1210 463L1183 455L1184 447L1171 439L1170 434L1158 421L1142 413L1138 404L1125 410L1124 412L1128 420L1125 427L1114 435L1113 437L1115 442L1114 444L1104 447L1104 441L1099 436L1074 422L1062 419L1054 414L1050 413L1035 396L1020 385L1018 378L1023 372L1031 371L1038 374L1041 366L1040 360L1022 334L1026 331L1045 331L1047 329L1047 326L1029 307L1015 300L1013 297L1014 282L1020 269L1029 252L1030 242L1021 239L1004 243L1003 240L1010 237L1011 233L1008 216L1013 215L1014 210L1019 213L1033 213L1033 209L1028 203L1011 196L1004 190L1004 183L1008 178L1000 174L997 170L1000 164L992 146L996 143L997 137L1005 134L1009 129L1019 132L1024 130L1035 124L1043 114L1050 113L1067 115L1074 114L1091 116L1097 119L1105 132L1122 143L1132 156L1136 155L1136 182L1155 198L1165 201L1170 206L1186 211L1190 215L1185 227L1180 229L1182 233L1193 238L1193 240L1192 242L1180 244L1180 247L1193 251L1198 255L1201 259L1209 262L1221 263L1230 268L1235 276L1243 274L1255 262L1266 259L1276 265L1282 269L1283 273L1270 276L1266 281L1265 286L1268 292L1279 301L1281 306ZM1018 377L1020 385L1035 396L1050 413L1054 414L1062 419L1074 422L1099 436L1104 441L1105 445L1104 447L1095 450L1093 455L1083 454L1081 457L1085 467L1083 475L1063 482L1059 477L1058 466L1056 465L1053 467L1033 496L1025 513L1031 523L1029 538L1029 543L1018 535L1013 524L996 505L976 492L975 490L977 486L967 487L961 478L961 474L970 466L964 452L963 430L975 427L976 415L979 407L992 395L999 396L1002 401L1006 401L1006 394L999 380L1000 377L1002 376L1009 378L1018 377ZM138 355L133 357L135 353L138 355ZM672 1145L669 1148L662 1148L655 1143L655 1132L663 1134L672 1145ZM652 1127L648 1129L644 1126L643 1124L649 1122L652 1124L652 1127ZM298 24L291 24L291 13L294 3L295 7L300 19L298 24ZM1238 -111L1247 -111L1255 -96L1267 -91L1272 -83L1279 -80L1286 -81L1293 -73L1292 -66L1294 -65L1274 -47L1265 -47L1250 -43L1237 -27L1228 -20L1228 -10L1218 0L1212 16L1203 26L1202 34L1189 55L1191 60L1177 69L1172 81L1173 89L1168 91L1163 102L1156 106L1141 104L1135 105L1132 113L1124 117L1117 113L1100 117L1097 119L1091 116L1074 114L1067 115L1050 113L1043 114L1035 124L1024 130L1015 131L1010 128L1005 134L998 137L983 140L978 139L969 150L956 155L914 151L902 143L899 139L884 135L877 130L872 122L849 105L844 96L835 88L817 80L808 66L808 62L804 58L800 44L786 44L798 33L804 30L813 29L816 18L812 15L810 8L813 3L812 -10L817 -10L826 -15L830 -24L827 -31L811 -36L810 -37L820 -45L827 -44L838 -38L859 -41L857 -57L860 -60L860 -66L867 -71L878 -69L901 -51L911 -47L940 -46L983 -49L987 -55L985 -59L988 -70L997 -75L1023 -77L1039 -81L1041 -86L1046 -91L1050 -92L1071 -83L1104 -100L1115 -123L1127 -125L1143 -125L1158 -121L1187 -125L1196 -120L1204 -108L1211 -104L1238 -111ZM1084 787L1086 792L1077 789L1070 784L1064 772L1052 757L1052 753L1057 750L1066 748L1073 753L1074 755L1067 763L1071 768L1075 783L1084 787ZM1552 558L1559 560L1565 567L1571 570L1575 590L1573 595L1568 596L1553 606L1553 620L1554 630L1536 655L1531 657L1529 653L1517 646L1490 641L1477 636L1472 637L1461 631L1453 633L1437 644L1429 643L1420 636L1414 635L1407 639L1396 651L1384 658L1374 655L1360 655L1359 662L1369 676L1365 682L1368 688L1380 689L1394 697L1404 715L1390 702L1372 694L1365 693L1358 697L1357 701L1376 719L1378 728L1374 733L1366 728L1353 708L1335 704L1332 708L1338 723L1354 734L1350 738L1333 731L1328 721L1327 708L1296 690L1292 681L1295 678L1297 671L1289 672L1275 680L1276 693L1271 718L1273 726L1291 750L1297 767L1301 774L1311 781L1321 794L1325 801L1328 812L1320 820L1315 820L1312 817L1316 809L1315 804L1303 797L1297 799L1291 804L1295 813L1301 827L1308 826L1298 835L1289 840L1273 841L1271 843L1280 845L1286 850L1305 856L1314 863L1322 864L1331 877L1346 881L1354 895L1366 898L1376 903L1379 907L1380 916L1382 959L1380 962L1376 962L1369 952L1347 929L1341 927L1335 931L1318 934L1307 940L1306 942L1314 950L1314 958L1318 968L1333 972L1340 984L1340 986L1322 992L1315 997L1311 994L1310 986L1299 978L1292 977L1286 971L1283 976L1286 991L1292 1001L1308 1045L1309 1053L1306 1066L1315 1085L1311 1085L1302 1077L1291 1061L1287 1051L1282 1051L1274 1052L1265 1073L1265 1085L1256 1079L1256 1060L1246 1042L1241 1040L1234 1027L1225 1031L1224 1041L1223 1050L1220 1056L1209 1044L1197 1022L1197 1010L1205 999L1204 991L1196 976L1184 966L1178 963L1175 953L1164 945L1163 941L1164 938L1176 927L1184 910L1187 910L1194 914L1203 912L1215 897L1225 898L1246 911L1270 919L1282 925L1288 932L1297 934L1295 925L1300 923L1312 923L1317 917L1314 912L1310 910L1303 908L1298 910L1291 907L1285 901L1272 895L1260 886L1257 891L1252 894L1245 895L1226 889L1214 893L1189 898L1178 881L1176 893L1167 895L1162 891L1153 865L1144 852L1137 849L1136 843L1137 837L1145 836L1159 841L1162 840L1165 838L1162 827L1148 826L1137 829L1132 827L1114 804L1101 797L1093 775L1078 759L1088 764L1094 765L1097 762L1101 750L1107 750L1102 732L1107 728L1109 725L1124 722L1128 718L1132 701L1139 685L1150 681L1156 668L1156 664L1150 652L1151 645L1178 643L1184 639L1197 643L1212 635L1223 619L1228 617L1242 614L1265 618L1283 612L1285 599L1287 597L1315 598L1321 591L1336 590L1351 591L1369 584L1379 584L1382 577L1407 578L1417 575L1423 586L1436 594L1441 591L1452 594L1463 598L1472 606L1492 600L1512 597L1522 599L1538 591L1540 586L1539 578L1533 563L1534 560L1536 557L1543 556L1552 558ZM294 -22L268 -37L246 -36L242 -40L239 -42L234 -40L223 -48L212 -43L210 -39L211 -36L214 -35L221 -36L222 -32L212 -29L195 -31L187 -28L174 -26L157 -27L147 -31L145 -37L145 -47L149 -61L150 -70L149 -76L151 -86L158 -98L168 -134L190 -159L190 -167L180 -171L151 -176L144 -179L139 -185L120 -181L114 -183L108 -181L105 -188L97 -191L94 -190L88 -185L85 -186L73 -202L70 -210L64 -214L56 -215L58 -230L66 -241L67 -250L49 -257L40 -267L38 -279L43 -293L57 -302L56 -315L43 -322L43 -325L48 -330L29 -345L34 -361L30 -365L22 -368L19 -373L20 -375L25 -374L40 -385L40 -386L36 -388L36 -392L44 -411L44 -419L37 -430L37 -434L26 -446L26 -450L42 -458L57 -452L62 -456L69 -455L85 -461L90 -468L84 -474L84 -478L103 -491L106 -497L108 -508L102 -514L92 -514L86 -516L82 -523L84 -527L83 -532L86 -533L106 -533L114 -559L118 -567L120 -598L109 -608L113 -626L120 -636L126 -638L152 -640L180 -639L192 -624L188 -617L195 -613L198 -615L202 -628L205 -631L217 -621L217 -609L220 -626L218 -637L219 -648L226 -658L247 -654L270 -656L279 -651L298 -630L305 -627L313 -625L302 -630L278 -656L271 -659L260 -660L253 -663L248 -670L248 -696L243 -700L238 -701L228 -699L227 -705L228 -710L242 -713L251 -717L252 -724L231 -749L230 -760L248 -760L269 -754L274 -751L280 -751L301 -755L310 -753L311 -751L321 -748L331 -737L332 -728L320 -717L340 -719L345 -711L356 -714L384 -702L406 -708L409 -698L405 -688L390 -678L394 -671L398 -670L412 -671L434 -665L439 -666L457 -681L464 -684L488 -687L492 -693L501 -698L523 -717L556 -711L565 -698L588 -684L609 -685L616 -672L619 -655L631 -647L648 -643L651 -626L660 -598L660 -592L657 -580L651 -573L644 -568L640 -563L639 -558L648 -548L668 -534L675 -523L671 -506L675 -498L680 -495L682 -491L682 -481L685 -478L680 -461L674 -453L685 -433L682 -424L683 -422L697 -416L705 -395L698 -371L686 -352L683 -352L675 -356L676 -361L671 -365L670 -369L653 -374L648 -370L657 -361L657 -360L621 -346L596 -340L587 -330L582 -332L577 -329L572 -328L568 -321L555 -319L550 -311L537 -313L532 -311L520 -309L513 -305L500 -288L492 -299L489 -301L486 -300L486 -297L492 -288L495 -280L500 -274L514 -266L518 -260L509 -244L517 -234L530 -211L540 -203L548 -203L565 -186L576 -180L584 -168L587 -166L595 -166L615 -147L613 -129L609 -124L605 -122L591 -128L589 -127L585 -109L582 -106L578 -103L560 -98L547 -90L536 -81L536 -78L551 -59L551 -51L547 -42L557 -40L558 -36L555 -18L552 -18L540 -24L538 -26L539 -31L537 -34L531 -37L516 -34L507 -39L495 -42L493 -32L458 -28L434 -19L427 -12L419 -12L408 -9L403 -10L397 -17L395 -22L385 -22L379 -25L362 -25L357 -7L353 -1L343 2L345 -6L335 -9L334 -15L327 -20L311 -28L303 -23L294 -22ZM291 449L289 464L294 475L296 514L285 537L283 562L274 584L269 591L247 578L240 571L246 560L233 554L236 543L235 537L226 537L226 534L232 526L232 520L224 514L222 508L230 502L227 496L222 494L228 487L233 475L241 469L258 464L265 457L276 461L278 459L280 453L279 436L282 428L286 428L289 432L291 449ZM151 -29L142 -25L136 -16L130 -13L120 -13L115 -19L109 -19L102 -15L97 -9L99 -6L104 -5L105 -2L80 27L64 35L61 55L42 69L35 84L35 87L39 92L37 102L28 109L28 115L30 116L36 115L45 111L50 105L47 98L47 97L54 91L62 87L73 86L88 89L87 93L91 102L88 114L101 128L106 137L100 143L90 149L89 156L90 159L96 163L106 180L116 190L111 206L104 209L93 217L82 216L77 218L77 223L82 228L85 238L90 242L100 244L104 247L107 258L102 262L93 279L97 287L95 291L97 296L102 302L116 310L133 317L153 314L156 322L141 344L142 353L138 355L135 353L133 357L118 364L95 386L84 393L79 404L67 413L53 416L39 423L32 420L16 420L5 412L-15 407L-21 395L-36 395L-39 393L-40 386L-52 387L-57 391L-59 389L-61 390L-61 392L-67 393L-103 382L-108 380L-111 374L-116 371L-126 374L-136 384L-175 411L-191 439L-191 446L-188 471L-179 487L-197 483L-203 484L-219 491L-221 496L-255 488L-267 495L-271 494L-275 487L-292 480L-289 474L-291 470L-307 466L-313 470L-318 461L-329 459L-362 446L-369 446L-372 461L-400 461L-404 458L-423 461L-442 447L-463 450L-476 436L-489 435L-507 428L-516 424L-517 420L-522 426L-526 426L-530 423L-526 415L-525 406L-530 403L-541 402L-551 398L-554 389L-542 386L-531 374L-520 328L-513 274L-507 264L-500 261L-506 254L-513 263L-509 214L-500 177L-481 192L-477 199L-471 221L-461 230L-463 225L-468 221L-474 192L-479 183L-485 176L-509 159L-510 153L-503 153L-497 156L-502 138L-505 99L-524 95L-553 78L-576 43L-576 38L-571 26L-575 19L-584 14L-577 4L-563 4L-550 8L-567 -1L-596 2L-607 -1L-609 -8L-601 -17L-605 -21L-611 -23L-627 -21L-629 -24L-624 -30L-628 -33L-641 -30L-649 -32L-656 -39L-664 -39L-669 -41L-677 -41L-682 -45L-712 -54L-724 -55L-736 -51L-742 -52L-747 -58L-751 -67L-770 -74L-766 -79L-747 -83L-744 -87L-751 -92L-757 -93L-762 -99L-759 -101L-749 -99L-737 -100L-741 -105L-748 -107L-773 -106L-776 -115L-773 -124L-759 -132L-723 -141L-708 -140L-698 -141L-685 -146L-679 -151L-661 -154L-644 -149L-621 -124L-603 -135L-575 -135L-569 -128L-562 -140L-556 -133L-523 -135L-530 -140L-537 -150L-538 -190L-546 -201L-555 -219L-559 -229L-558 -238L-538 -237L-522 -241L-514 -238L-514 -230L-512 -219L-505 -209L-491 -209L-477 -206L-458 -206L-432 -200L-420 -203L-409 -210L-388 -215L-386 -217L-399 -216L-410 -221L-411 -226L-406 -240L-373 -256L-350 -261L-326 -270L-314 -279L-306 -291L-300 -295L-303 -299L-301 -344L-299 -352L-294 -358L-276 -369L-236 -377L-230 -380L-225 -366L-226 -361L-225 -358L-213 -345L-207 -341L-187 -348L-181 -343L-177 -336L-174 -323L-171 -321L-150 -318L-148 -316L-143 -301L-139 -304L-123 -304L-116 -302L-107 -295L-110 -284L-105 -279L-109 -270L-107 -266L-92 -265L-79 -266L-71 -270L-67 -280L-62 -284L-59 -285L-55 -284L-61 -266L-57 -261L-55 -249L-44 -248L-36 -242L-24 -238L-7 -221L14 -224L17 -220L31 -215L43 -220L48 -219L56 -215L64 -214L70 -210L73 -202L85 -186L88 -185L94 -190L97 -191L105 -188L108 -181L114 -183L120 -181L139 -185L144 -179L151 -176L180 -171L190 -167L190 -159L168 -134L158 -98L151 -86L149 -76L150 -70L149 -61L145 -47L145 -37L147 -31L151 -29ZM597 178L600 182L620 187L624 185L628 179L635 182L657 182L661 179L669 165L672 164L678 173L689 182L693 183L701 180L712 185L722 186L729 183L725 172L726 169L731 165L725 157L738 150L751 147L753 144L754 125L749 119L748 116L752 110L774 102L779 99L784 93L796 93L798 91L797 82L798 79L803 77L811 78L835 88L844 96L849 105L856 111L872 122L877 130L884 135L899 139L902 143L914 151L956 155L969 150L978 139L983 140L997 137L996 143L992 146L1000 164L997 170L1000 174L1008 178L1004 183L1004 190L1011 196L1028 203L1034 211L1033 213L1019 213L1014 210L1013 215L1008 216L1011 233L1010 237L1008 239L1004 238L1004 243L991 242L988 239L985 227L978 222L965 221L950 217L939 218L928 216L919 222L915 222L903 214L891 218L878 214L870 214L863 213L848 202L838 210L819 208L801 229L796 227L781 211L776 209L771 208L763 212L759 253L770 262L783 276L787 278L795 309L801 318L823 339L832 352L860 378L873 383L874 385L876 399L902 429L902 434L898 436L878 419L864 409L847 391L824 384L808 376L789 379L778 378L775 373L775 364L741 339L718 313L713 304L725 301L739 303L724 292L703 270L696 259L697 233L693 222L670 200L658 196L652 196L649 202L647 214L627 246L619 246L601 219L593 182L597 178ZM828 430L841 433L852 432L861 434L868 438L860 439L852 437L843 440L834 439L829 434L828 430ZM868 417L830 418L820 416L807 409L818 407L828 409L831 412L868 417ZM838 403L816 401L810 398L813 391L841 395L846 399L838 403ZM721 324L723 327L710 316L721 324ZM690 232L681 234L675 227L667 226L662 220L668 215L672 207L690 232ZM691 254L693 259L680 253L679 248L681 245L686 245L691 254ZM718 296L716 299L698 281L695 276L685 260L693 268L696 269L722 295L718 296ZM718 338L719 340L714 339L694 313L718 338ZM732 333L737 340L732 339L727 334L724 329L732 333ZM666 264L665 268L661 263L652 240L652 236L655 232L655 228L651 215L654 214L656 213L659 227L664 233L663 243L666 264ZM899 453L909 460L880 451L883 450L899 453ZM961 474L961 478L967 487L916 450L898 446L873 433L857 428L870 427L908 445L904 440L909 439L914 440L917 445L938 461L952 470L961 474ZM1018 377L1009 378L1002 376L1000 377L999 380L1006 394L1006 401L1002 401L999 396L992 395L979 407L976 415L975 427L963 430L964 452L970 466L963 474L952 470L938 461L917 445L914 440L909 439L904 440L898 436L902 434L902 429L876 399L874 385L873 383L860 378L832 352L823 339L801 318L795 309L787 278L783 276L770 262L759 253L763 212L771 208L776 209L781 211L791 223L801 229L819 208L838 210L848 202L863 213L870 214L878 214L891 218L903 214L915 222L919 222L928 216L939 218L950 217L965 221L978 222L985 227L988 239L991 242L1007 243L1021 239L1030 242L1029 252L1025 260L1015 277L1012 294L1015 300L1029 307L1045 323L1047 326L1047 329L1045 331L1026 331L1022 334L1040 360L1041 366L1038 374L1031 371L1026 371L1023 372L1018 377ZM294 3L300 -9L301 -17L294 -22L303 -23L311 -28L332 -17L335 -13L335 -9L337 -8L345 -6L343 2L353 -1L357 -7L362 -25L379 -25L385 -22L395 -22L397 -17L403 -10L408 -9L419 -12L427 -12L434 -19L458 -28L493 -32L495 -42L507 -39L516 -34L531 -37L537 -34L539 -31L538 -26L540 -24L552 -18L555 -18L558 -36L557 -40L547 -42L551 -51L551 -59L536 -78L536 -81L540 -86L560 -98L578 -103L582 -106L585 -109L589 -127L591 -128L605 -122L609 -124L613 -129L615 -147L628 -139L633 -130L657 -128L666 -133L681 -130L682 -137L688 -145L691 -147L698 -147L702 -168L703 -170L709 -170L716 -165L727 -167L757 -156L766 -156L783 -145L806 -144L815 -150L820 -150L832 -143L845 -140L850 -129L844 -114L844 -109L860 -74L865 -71L860 -66L860 -60L856 -54L859 -41L838 -38L823 -45L820 -45L810 -37L811 -36L827 -31L830 -24L826 -15L817 -10L812 -10L813 3L810 8L812 15L816 18L813 29L804 30L782 46L777 50L777 59L776 62L761 59L751 60L745 65L737 67L720 66L696 69L686 80L670 90L617 79L591 74L567 73L515 63L509 60L491 36L489 31L494 24L492 22L462 31L444 30L423 32L414 36L404 52L391 52L386 51L381 45L365 44L363 43L361 34L356 31L343 44L339 45L320 36L318 29L298 24L300 19L294 3ZM223 1036L225 1047L213 1054L207 1067L195 1078L195 1081L202 1085L206 1093L198 1150L204 1165L204 1190L209 1210L203 1221L198 1257L189 1274L168 1289L161 1305L143 1322L142 1347L145 1358L158 1394L160 1403L162 1407L185 1421L188 1424L195 1437L202 1460L205 1476L256 1520L258 1523L294 1707L278 1718L303 1766L315 1812L318 1833L316 1874L319 1926L323 1951L311 1997L314 2026L317 2038L322 2045L321 2067L319 2075L291 2097L287 2105L286 2115L288 2123L329 2197L332 2225L338 2251L346 2262L349 2271L359 2281L362 2282L381 2275L442 2298L477 2378L141 2643L18 2782L11 2787L-162 2830L-170 2831L-186 2820L-187 2815L-180 2799L-176 2793L-176 2789L-180 2774L-180 2751L-185 2745L-205 2734L-239 2724L-249 2709L-253 2705L-275 2703L-288 2697L-293 2692L-299 2675L-323 2659L-332 2648L-332 2632L-334 2620L-798 2216L-1070 2001L-1069 1861L-1068 1858L-1060 1853L-995 1795L-990 1792L-980 1791L-956 1769L-951 1767L-916 1773L-914 1772L-908 1764L-907 1752L-905 1748L-885 1749L-869 1747L-852 1743L-827 1734L-816 1724L-807 1713L-792 1683L-777 1675L-743 1660L-718 1639L-697 1636L-694 1634L-691 1630L-691 1623L-695 1619L-705 1613L-706 1610L-703 1594L-708 1568L-706 1564L-702 1561L-677 1559L-645 1547L-639 1526L-634 1522L-603 1517L-515 1521L-511 1519L-514 1503L-512 1496L-499 1483L-503 1475L-528 1451L-533 1442L-535 1423L-541 1412L-545 1398L-542 1373L-548 1352L-546 1331L-547 1312L-554 1293L-549 1283L-558 1269L-554 1255L-579 1233L-583 1227L-586 1220L-571 1221L-563 1221L-545 1212L-531 1200L-520 1194L-501 1172L-488 1163L-451 1144L-446 1144L-434 1148L-423 1147L-416 1140L-408 1124L-396 1114L-347 1086L-325 1078L-244 1069L-225 1070L-206 1056L-197 1052L-156 1050L-136 1040L-63 1040L-54 1044L-30 1062L-23 1065L-13 1062L9 1050L35 1044L49 1036L54 1025L66 1021L73 1030L99 1038L123 1033L120 1021L137 1024L150 1030L164 1042L173 1044L189 1039L223 1036ZM1029 543L1031 523L1025 513L1048 473L1053 467L1056 465L1059 469L1059 477L1063 482L1083 475L1086 478L1097 496L1105 499L1115 508L1122 529L1122 538L1116 559L1117 573L1112 578L1115 591L1115 603L1121 617L1128 624L1132 637L1134 639L1144 638L1148 640L1150 643L1150 652L1156 664L1156 668L1150 681L1139 685L1132 701L1128 718L1124 722L1109 725L1107 728L1102 732L1107 750L1101 750L1097 762L1094 765L1088 764L1078 759L1078 750L1067 726L1040 709L1033 702L1028 689L1037 693L1038 689L1029 664L1038 637L1040 606L1037 587L1041 574L1047 566L1047 551L1039 544L1029 543Z","it":"M106 138L112 142L116 142L126 139L132 139L134 138L143 134L145 132L153 133L157 137L167 139L169 136L170 136L170 134L172 132L179 130L181 127L182 121L185 120L188 117L190 114L190 110L185 105L185 104L188 101L194 99L198 95L201 93L202 91L201 89L204 87L210 85L212 85L213 89L211 102L212 106L218 109L225 118L231 120L234 119L236 121L240 121L242 123L237 132L245 135L248 142L247 147L250 146L255 148L259 140L259 138L255 137L253 134L256 131L255 126L259 124L260 118L267 113L268 110L272 107L275 97L274 88L273 86L273 84L276 80L281 80L281 81L283 83L287 80L288 92L291 94L292 98L295 100L305 101L308 99L308 96L309 95L312 96L319 93L324 93L327 94L328 100L332 104L333 108L335 108L341 106L341 104L336 97L337 95L339 92L340 90L339 89L333 87L332 85L333 83L332 82L332 77L335 74L337 69L344 67L347 68L347 73L352 75L363 76L365 72L364 68L359 66L357 63L359 60L359 56L362 54L361 50L363 48L363 44L366 45L369 46L378 44L385 47L386 48L383 51L384 51L392 52L395 54L399 53L404 53L408 49L411 40L417 34L428 31L435 33L440 29L444 31L449 30L456 31L459 33L472 27L480 26L488 22L493 22L495 22L494 25L489 29L488 31L490 37L489 39L492 40L494 42L499 43L500 52L505 53L507 59L510 61L517 63L520 65L526 64L530 65L532 66L535 66L541 69L565 71L572 75L582 73L590 74L592 75L607 78L605 85L599 86L594 91L587 95L583 100L582 101L585 109L587 109L586 107L589 108L596 112L602 112L603 114L600 117L592 123L590 126L591 127L589 129L592 133L600 131L601 133L597 144L597 147L600 150L604 151L613 156L619 165L621 167L618 171L607 171L609 169L615 169L610 165L611 165L611 163L609 160L603 154L597 151L596 151L593 154L594 156L596 156L584 163L582 162L586 160L586 158L583 157L582 156L573 154L570 152L567 153L565 155L563 153L562 154L564 156L560 157L560 160L561 161L565 160L561 166L550 167L538 175L510 186L512 182L511 182L513 182L513 180L515 181L514 180L517 179L517 180L516 181L518 181L518 178L521 177L523 175L520 176L517 173L514 175L513 177L513 179L511 178L510 178L509 176L509 179L511 180L509 181L508 180L506 180L503 181L498 186L498 189L499 191L498 194L496 195L497 196L495 199L491 199L490 201L493 204L494 203L494 200L496 201L496 205L495 206L497 210L499 210L502 207L502 208L503 213L504 220L502 219L502 217L501 221L504 222L503 221L506 223L507 226L506 228L507 229L508 226L507 223L510 226L510 227L516 232L517 232L516 231L517 231L519 233L518 238L517 238L516 244L513 248L511 245L512 240L511 240L510 241L509 244L510 246L509 247L511 248L509 251L507 251L502 246L499 247L500 248L498 255L498 263L501 269L501 281L503 294L505 297L507 305L515 316L522 321L529 329L533 332L540 333L549 338L573 360L590 369L593 367L597 373L600 374L600 377L617 417L625 450L635 470L646 483L658 493L661 498L671 507L682 512L685 522L694 527L703 529L707 533L713 537L716 537L725 537L737 539L750 537L762 538L781 536L789 538L791 541L792 541L793 551L790 555L787 556L781 562L773 566L771 569L771 576L774 582L781 587L785 589L788 591L813 604L818 605L823 609L858 622L874 632L880 639L885 642L889 647L902 652L910 655L917 661L925 663L925 665L929 665L932 670L932 674L938 680L947 684L961 703L967 716L967 720L966 722L965 724L961 728L960 732L958 737L958 748L956 750L954 750L950 747L944 746L934 739L928 731L930 729L930 726L926 724L929 723L930 720L929 718L923 712L921 705L922 705L918 702L892 700L887 697L884 697L869 688L872 686L873 684L871 683L872 682L876 683L878 680L873 681L874 680L872 680L868 682L865 679L857 678L852 681L847 685L837 700L834 710L824 722L824 727L826 733L817 746L816 753L819 758L817 761L820 764L826 768L837 769L840 771L842 775L850 780L855 781L860 788L866 789L863 796L862 803L865 809L863 821L865 825L869 827L867 829L867 834L862 840L861 838L859 838L856 839L854 837L851 836L842 838L833 842L822 851L819 860L820 861L822 877L821 888L814 895L804 900L792 916L787 933L785 936L779 938L775 937L761 937L755 935L752 929L752 927L753 926L751 921L753 916L751 908L753 906L763 902L765 899L772 883L773 875L767 867L767 865L769 863L779 858L789 858L792 855L795 849L795 840L794 837L791 835L785 822L781 796L779 786L774 779L769 774L767 765L764 760L763 749L762 748L762 741L757 732L751 724L751 722L744 722L735 731L730 730L727 726L724 727L725 725L724 723L713 713L707 713L704 709L697 706L697 704L699 699L699 697L704 694L704 690L694 669L688 663L685 662L680 665L676 665L670 669L666 667L661 668L655 673L654 669L654 668L658 666L662 661L665 660L665 657L662 655L659 654L651 646L646 647L644 650L635 647L635 652L633 651L633 643L631 638L627 630L623 628L623 623L618 615L608 605L599 605L596 606L597 609L595 609L593 607L592 608L590 606L579 601L576 600L569 602L563 605L561 607L558 607L554 599L546 590L542 588L535 588L528 583L527 585L513 567L504 559L497 556L496 553L495 547L492 542L490 540L482 533L481 531L479 530L473 526L466 527L461 517L460 513L454 502L445 495L434 491L433 489L430 490L421 488L420 489L418 493L416 493L413 491L411 487L413 485L417 486L418 482L418 478L416 474L414 474L412 469L410 469L410 467L405 463L404 459L400 456L384 450L387 447L388 440L386 437L377 434L370 435L370 437L368 437L367 436L365 431L368 428L370 415L369 405L362 391L353 381L348 345L345 338L336 327L329 324L328 325L326 325L318 319L317 319L317 320L316 321L318 323L317 325L318 325L317 326L316 324L312 322L306 316L301 315L298 311L292 308L291 306L287 306L286 304L283 303L282 301L272 295L270 299L266 297L264 294L262 293L255 291L249 289L243 289L242 287L237 287L222 294L215 300L213 302L214 304L212 306L211 307L210 311L199 317L197 320L196 325L191 332L192 334L186 338L185 340L177 345L164 348L157 351L145 352L142 351L141 344L142 341L152 331L154 326L157 323L156 319L153 316L154 312L152 312L149 314L130 318L128 315L108 306L104 306L95 294L96 288L99 286L94 283L92 277L101 267L100 265L102 262L104 261L109 261L105 251L105 248L104 245L98 244L93 244L86 239L84 237L84 229L79 227L78 223L75 220L77 217L85 214L93 217L96 216L95 213L98 213L102 209L107 207L109 209L113 204L112 198L116 192L117 189L112 186L110 183L104 179L103 173L101 171L102 166L91 160L90 158L88 152L90 147L93 146L95 147L95 145L101 144L106 138ZM511 341L514 340L516 334L516 332L511 333L509 335L508 338L511 341ZM479 1046L483 1051L483 1053L482 1056L479 1055L475 1051L473 1047L475 1046L476 1046L478 1048L479 1046ZM500 936L503 935L507 937L505 939L503 937L501 938L500 936ZM744 900L753 902L753 903L747 907L746 910L747 910L741 922L733 932L724 949L720 954L720 959L719 962L716 973L711 981L711 996L712 998L720 1002L723 1004L724 1007L722 1005L720 1008L721 1006L719 1005L718 1009L720 1014L723 1014L721 1015L723 1018L727 1020L727 1024L726 1023L725 1025L728 1026L729 1029L727 1028L724 1030L724 1033L719 1035L716 1038L711 1050L714 1061L713 1064L711 1065L705 1060L703 1061L695 1057L688 1060L685 1058L681 1057L678 1055L673 1052L666 1051L657 1033L650 1026L645 1022L636 1018L627 1019L624 1020L621 1020L617 1016L608 1013L597 1003L591 1001L586 999L575 991L573 987L567 981L555 980L554 976L550 973L544 972L529 974L524 966L521 964L517 963L511 950L511 949L514 948L515 942L514 939L517 930L516 928L523 923L525 924L528 921L529 918L532 919L534 917L534 911L535 912L536 912L541 922L547 927L550 927L559 922L559 919L558 916L562 911L570 912L572 912L572 909L578 908L579 910L582 913L583 920L593 919L595 921L596 925L603 930L607 931L607 932L613 933L631 925L635 928L640 927L650 928L654 928L661 925L664 926L667 926L677 922L684 914L689 914L697 911L699 911L702 914L708 915L709 917L711 917L717 914L722 906L722 903L722 908L726 909L734 907L744 900ZM702 887L702 888L704 891L704 893L703 894L700 890L700 889L702 887ZM697 883L697 880L698 878L702 878L701 880L702 881L700 882L702 885L697 883ZM694 875L694 876L689 873L690 872L693 872L695 873L694 875ZM214 823L216 823L214 825L212 833L211 834L210 833L207 827L206 820L207 818L209 820L213 820L214 823ZM203 811L203 820L200 820L199 819L199 818L197 814L197 813L203 811ZM625 660L621 661L619 659L618 658L619 655L619 654L620 654L627 656L627 658L625 660ZM200 624L198 626L198 631L195 630L197 626L200 623L201 619L202 619L204 617L205 623L200 624ZM314 674L317 677L315 684L311 692L308 693L301 704L302 709L304 716L310 722L306 734L307 737L308 737L307 738L306 742L307 745L305 748L305 759L303 765L304 773L302 780L303 782L300 796L302 800L298 803L297 806L297 810L298 811L297 815L294 818L294 820L292 817L288 818L277 808L276 809L271 807L269 808L267 811L265 811L260 805L259 806L257 804L256 804L257 807L261 808L256 815L256 821L258 824L257 831L255 831L244 842L240 839L240 841L237 838L233 837L230 839L229 843L228 844L228 841L225 840L226 835L225 834L223 834L222 824L221 825L218 824L219 822L218 821L216 822L215 818L213 818L212 817L212 813L211 812L210 813L209 810L208 808L212 800L211 796L208 794L208 792L210 787L209 783L212 777L214 772L213 754L215 755L218 760L222 760L218 758L218 756L221 752L219 754L221 748L221 742L217 739L214 739L212 740L214 740L212 744L211 741L209 739L209 731L210 728L209 726L208 727L210 725L215 724L216 721L214 708L215 701L213 697L209 695L209 686L207 681L205 679L203 672L202 670L196 673L194 672L196 669L194 668L192 674L191 672L190 668L193 666L195 661L193 660L190 657L196 642L195 639L193 637L195 632L197 634L197 639L201 643L203 645L219 647L225 645L228 640L233 638L237 639L241 635L246 628L249 626L255 618L263 616L265 614L265 615L267 612L267 606L272 604L275 606L276 610L275 609L276 608L276 610L278 610L280 611L280 609L284 612L284 611L286 612L285 614L288 617L288 621L290 617L289 616L290 615L293 616L294 615L294 617L296 618L297 617L297 620L296 622L295 621L293 628L294 628L294 627L295 626L296 627L296 629L301 628L304 630L303 631L300 630L299 630L297 636L293 636L293 637L293 639L295 638L298 639L301 638L303 638L301 641L304 642L304 644L306 643L309 645L306 646L306 649L305 649L304 650L305 651L305 650L307 654L310 662L312 671L313 672L314 674ZM397 491L400 497L399 498L398 498L394 493L396 491L397 491ZM363 446L362 451L359 454L361 456L362 458L361 459L358 458L355 453L353 456L352 454L349 455L348 454L347 456L341 456L338 454L337 452L338 450L341 448L348 450L349 450L349 449L350 447L354 447L354 449L356 449L360 443L363 446ZM318 424L319 426L316 429L315 429L313 427L315 423L317 423L318 424ZM506 190L509 187L511 189L510 188L507 188L503 195L506 190ZM672 872L673 874L671 874L670 871L672 872ZM567 858L569 859L566 861L566 860L567 858ZM721 849L722 850L722 851L721 852L719 852L718 851L721 849ZM526 1179L525 1181L520 1179L519 1178L521 1178L526 1179ZM485 933L485 935L484 935L482 933L482 931L483 931L485 933ZM290 606L290 613L288 612L287 611L288 608L289 606L290 606ZM287 607L287 608L283 609L283 607L284 605L286 604L287 607ZM352 495L352 495L353 496L353 498L352 497L352 495ZM336 470L337 472L333 472L335 469L336 470ZM504 184L507 185L506 187L503 187L504 184Z"};
// il centro delle regioni (e di qualche paese vicino), per i ceppi senza coordinate: lì il punto è vuoto
export const REGIONI = [
  ['Piemonte', 45.05, 7.92, /piemonte/i], ['Valle d\'Aosta', 45.74, 7.43, /aosta/i], ['Lombardia', 45.62, 9.85, /lombardia/i],
  ['Trentino-Alto Adige', 46.43, 11.17, /trentino|alto adige|s\u00fcdtirol/i], ['Veneto', 45.65, 11.85, /veneto/i], ['Friuli-Venezia Giulia', 46.15, 13.05, /friuli/i],
  ['Liguria', 44.3, 8.72, /liguria/i], ['Emilia-Romagna', 44.53, 11.0, /emilia|romagna/i], ['Toscana', 43.35, 11.0, /toscana/i], ['Umbria', 42.97, 12.49, /umbria/i],
  ['Marche', 43.3, 13.15, /\bmarche\b/i], ['Lazio', 41.98, 12.77, /lazio/i], ['Abruzzo', 42.23, 13.85, /abruzzo/i], ['Molise', 41.68, 14.6, /molise/i],
  ['Campania', 40.85, 14.8, /campania/i], ['Puglia', 41.0, 16.5, /puglia|apulia/i], ['Basilicata', 40.5, 16.08, /basilicata|lucania/i], ['Calabria', 39.07, 16.35, /calabria/i],
  ['Sicilia', 37.55, 14.15, /sicilia|sicily/i], ['Sardegna', 40.05, 9.03, /sardegna|sardinia/i],
  ['Croazia', 45.1, 15.2, /croazia|croatia|hrvatska/i], ['Slovenia', 46.15, 14.99, /slovenia/i], ['Svizzera', 46.8, 8.2, /svizzera|switzerland/i], ['Malta', 35.9, 14.4, /malta/i],
];

// =====================================================================
//  Giro 48: il colore tipico della colonia, per il bordo dei riquadri dei generi.
//  Colori di Okabe e Ito, distinguibili anche da chi non vede bene i colori;
//  i generi con lo stesso aspetto (le muffe scure, quelle verdi) hanno lo stesso colore
// =====================================================================
export const GEN_COL = {
  rp: ['Fusarium', 'Gibberella'],
  vm: ['Microdochium', 'Monographella', 'Colletotrichum'],
  or: ['Epicoccum'],
  bg: ['Aspergillus', 'Trichoderma'],
  bl: ['Penicillium', 'Talaromyces'],
  sb: ['Phytophthora', 'Pythium', 'Globisporangium'],
  dk: ['Alternaria', 'Cladosporium', 'Stemphylium', 'Curvularia', 'Bipolaris', 'Drechslera', 'Pyrenophora', 'Exserohilum', 'Ulocladium', 'Aureobasidium', 'Chaetomium',
    'Nigrospora', 'Apiospora', 'Arthrinium', 'Botryosphaeria', 'Diplodia', 'Neofusicoccum', 'Lasiodiplodia', 'Phoma', 'Didymella', 'Paraphoma'],
  gr: ['Botrytis', 'Sclerotinia', 'Rhizoctonia', 'Rhizopus', 'Mucor', 'Verticillium', 'Acremonium', 'Sarocladium', 'Trametes', 'Pleurotus'],
};
