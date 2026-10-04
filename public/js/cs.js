export const PURPOSE = 'Ťuk je osobní deník pro zápis a sdílení údajů, které si uživatel sám zapíše. Nehodnotí, nediagnostikuje, nepředpovídá, nedává doporučení a nenahrazuje lékaře. Není zdravotnickým prostředkem. V nouzi volejte 112 nebo 155.';

export const PRIVACY = 'Data zůstávají jen v tomto telefonu. Aplikace je neposílá na žádný server, dokud je sami neodešlete (sdílením nebo zálohou). Hosting stránky může při stažení aplikace vidět IP adresu, ale ne vaše záznamy. Při smazání dat prohlížeče nebo odinstalaci aplikace data zmizí, proto si občas uložte zálohu.';

// Odkaz na zdrojový kód; vyplnit při publikaci (Task 11). Prázdný = odkaz se nezobrazí.
export const SOURCE_URL = 'https://github.com/mik67/tuk';

export const INSTALL = {
  installed: { title: 'Aplikace je nainstalovaná', steps: [] },
  prompt: { title: 'Nainstalujte si Ťuk do telefonu', steps: ['Ikona se objeví na ploše a aplikace poběží i bez připojení.'], button: 'Nainstalovat' },
  'ios-safari': {
    title: 'Přidejte si Ťuk na plochu iPhonu',
    steps: [
      'Klepněte dole na tlačítko Sdílet (čtverec se šipkou nahoru).',
      'Posuňte seznam a vyberte „Přidat na plochu“.',
      'Potvrďte „Přidat“. Ikona Ťuk se objeví na ploše a otevírejte ho odtud.',
    ],
  },
  'ios-other': {
    title: 'Pro instalaci otevřete odkaz v Safari',
    steps: [
      'Zkopírujte odkaz na tuto stránku a otevřete ho v Safari.',
      'V Safari klepněte na Sdílet a vyberte „Přidat na plochu“.',
      'Na novějších verzích iOS může „Přidat na plochu“ fungovat i v jiných prohlížečích.',
    ],
  },
  'android-manual': {
    title: 'Přidejte si Ťuk na plochu',
    steps: [
      'V Chrome klepněte na tři tečky vpravo nahoře.',
      'Vyberte „Instalovat aplikaci“ nebo „Přidat na plochu“.',
      'Potvrďte. Ikona Ťuk se objeví na ploše.',
    ],
  },
  desktop: {
    title: 'Ťuk je určený pro telefon',
    steps: ['Otevřete odkaz na telefonu (naskenujte QR kód z Nastavení). V počítači aplikace funguje také, ale instalace je pohodlnější v telefonu.'],
  },
};
