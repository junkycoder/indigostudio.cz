const input = document.querySelector('#search');
const sections = [...document.querySelectorAll('.directory-section')];
const entries = [...document.querySelectorAll('.service')];
const counter = document.querySelector('#search-count');
const empty = document.querySelector('#empty');
const navigation = [...document.querySelectorAll('.section-nav a')];

const normalize = text => text.toLocaleLowerCase('cs-CZ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = {
  'Datové schránky': 'datovka datovky',
  'MOJE daně': 'danove priznani dis plus',
  'eDálnice': 'dalnicni znamka',
  'Klientská zóna Jenda': 'davky socialni podpora',
  'ČT iVysílání': 'ceska televize ct archiv',
  'mujRozhlas': 'cesky rozhlas cr podcast',
  'Katastr nemovitostí': 'parcely byty pozemky',
  'Portál občana': 'egov e government',
};
const categoryAliases = {
  urady: 'egov statni sluzby',
  pojisteni: 'pojistovna pojistovny',
  sledovani: 'streaming streamovaci sluzby',
};
const searchIndex = new Map(entries.map(entry => {
  const name = entry.querySelector('strong')?.textContent || '';
  const section = entry.closest('.directory-section');
  const category = section.querySelector('h2')?.textContent || '';
  return [entry, normalize(`${entry.textContent} ${entry.href} ${category} ${categoryAliases[section.id] || ''} ${aliases[name] || ''}`)];
}));

function filterServices() {
  const query = normalize(input.value);
  const words = query ? query.split(' ') : [];
  let shown = 0;
  for (const entry of entries) {
    const match = words.every(word => searchIndex.get(entry).includes(word));
    entry.hidden = !match;
    if (match) shown++;
  }
  for (const section of sections) {
    const visible = section.querySelector('.service:not([hidden])') !== null;
    section.hidden = !visible;
    document.querySelector(`[data-nav-id="${section.id}"]`).hidden = !visible;
  }
  empty.hidden = shown > 0;
  counter.textContent = query ? `${shown} ${shown === 1 ? 'výsledek' : shown >= 2 && shown <= 4 ? 'výsledky' : 'výsledků'}` : 'Procházejte podle oblasti nebo začněte psát.';
}

input.addEventListener('input', filterServices);
document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === 'Escape' && document.activeElement === input) {
    input.value = '';
    filterServices();
    input.blur();
  }
});

navigation.forEach(link => link.addEventListener('click', () => {
  navigation.forEach(other => other.classList.toggle('active', other === link));
}));
