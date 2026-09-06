
const SUPABASE_URL = 'https://iollrrbpjsmvxozkpxeh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TSiatPuLjWMSx27rnsJTBw_Wxtc_F3y';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
window.BozoSupabase = sb;

const state = {
  session: null,
  profile: null,
  role: 'member',
  progress: null
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.hidden = true, 3200);
}


const BOZO_NAME_MAX_LENGTH = 20;

function normalizeNameForModeration(value='') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Common Unicode / visual confusables.
    .replace(/[ıɩΙІӀ]/g, 'i')
    .replace(/[ⅼℓ]/g, 'l')
    .replace(/[οоօ〇]/g, 'o')
    .replace(/[аɑ]/g, 'a')
    .replace(/[еҽ]/g, 'e')
    .replace(/[ѕ]/g, 's')
    .replace(/[с]/g, 'c')
    .replace(/[к]/g, 'k')
    .replace(/[х]/g, 'x')
    .replace(/[р]/g, 'p')
    .replace(/[у]/g, 'y')
    // Leetspeak.
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[8]/g, 'b')
    .replace(/[9]/g, 'g')
    .replace(/[^a-z0-9]/g, '');
}

function moderationVariants(value='') {
  const compact = normalizeNameForModeration(value);
  const variants = new Set([compact]);

  // Lowercase L and uppercase I are visually confusable in many fonts.
  // Generate moderation-only variants without rewriting the displayed name.
  variants.add(compact.replace(/l/g, 'i'));
  variants.add(compact.replace(/i/g, 'l'));
  variants.add(compact.replace(/[li]/g, 'i'));
  variants.add(compact.replace(/[li]/g, 'l'));

  return [...variants];
}


const BOZO_HARD_BLOCK_TERMS = [
  'fuck','shit','bitch','cunt','sex','slut','whore','pussy','dick','cock',
  'motherfucker','faggot','fag','retard','nigger','nigga','beaner','chink',
  'kike','spic','wetback','gook','coon','raghead','sandnigger','towelhead',
  'tranny','shemale','dyke','cripple','mongoloid',
  'childpredator','pedophile','pedo','molester','rapist','rape',
  'goatbanger','terrorist','kkk','nazis','nazi'
];

const BOZO_NOTORIOUS_NAMES = [
  'adolfhitler','hitler','josephstalin','stalin','osamabinladen','binladen'
];

const BOZO_RELIGIOUS_FIGURES = [
  'god','satan','lucifer','buddha','budha','allah','muhammad','mohammed',
  'yahweh','jehovah','zeus','hera','poseidon','hades','aphrodite','ares',
  'apollo','artemis','athena','hermes','odin','thor','loki','freya','frigg',
  'anubis','ra','isis','osiris','horus','seth','vishnu','shiva','krishna',
  'ganesha','brahma','lakshmi','saraswati','hanuman','indra','mars','venus',
  'jupiter','neptune','pluto','mercury','minerva','juno'
];

const BOZO_IDENTITY_TERMS = [
  'jew','jewish','gay','black','muslim','islamic','christian','hindu',
  'asian','latino','latina','mexican','arab','white','trans','lesbian'
];

const BOZO_CONTEXT_INSULTS = [
  'welfare','lazy','dirty','stupid','dumb','trash','vermin','rat','monkey',
  'ape','pig','goat','banger','killer','hater','sucks','degenerate',
  'inferior','slave','terrorist','pedo','predator','rapist','whore','slut'
];

function containsAnyTerm(candidate, terms) {
  return terms.some(term => candidate.includes(term));
}

function violatesBozoContextPolicy(candidate) {
  if (containsAnyTerm(candidate, BOZO_NOTORIOUS_NAMES)) return true;

  // Religious names are reserved from impersonation/provocation-style handles.
  // "jesus" intentionally not hard-blocked because it is also a common given name.
  if (BOZO_RELIGIOUS_FIGURES.includes(candidate)) return true;

  // Religious figure + identity/insult compound, e.g. GayZeus / AphroditeTheJew.
  const hasReligiousFigure = containsAnyTerm(candidate, BOZO_RELIGIOUS_FIGURES);
  const hasIdentity = containsAnyTerm(candidate, BOZO_IDENTITY_TERMS);
  const hasContextInsult = containsAnyTerm(candidate, BOZO_CONTEXT_INSULTS);
  if (hasReligiousFigure && (hasIdentity || hasContextInsult)) return true;

  // Identity term combined with degrading/provocative context.
  if (hasIdentity && hasContextInsult) return true;

  // Multi-identity mashups are treated as likely bait/trolling.
  const identityHits = BOZO_IDENTITY_TERMS.filter(term => candidate.includes(term)).length;
  if (identityHits >= 2) return true;

  return false;
}

function bozoNameModerationReason(value='') {
  const raw = String(value || '').trim();
  if (!raw) return 'Name is required.';
  if (raw.length > BOZO_NAME_MAX_LENGTH) return `Names can be at most ${BOZO_NAME_MAX_LENGTH} characters.`;

  const variants = moderationVariants(raw);

  const regexBlocked = [
    /f+u+c+k+/,
    /s+h+i+t+/,
    /b+i+t+c+h+/,
    /c+u+n+t+/,
    /s+e+x+/,
    /n+i+g{2,}(?:e+r+|a+h*)/,
    /f+a+g{1,}(?:g+o+t+)?/,
    /r+e+t+a+r+d+/,
    /w+h+o+r+e+/,
    /s+l+u+t+/,
    /p+u+s+s+y+/,
    /d+i+c+k+/,
    /c+o+c+k+/,
    /m+o+t+h+e+r+f+u+c+k+e+r+/
  ];

  const blocked = variants.some(candidate =>
    regexBlocked.some(pattern => pattern.test(candidate)) ||
    containsAnyTerm(candidate, BOZO_HARD_BLOCK_TERMS) ||
    violatesBozoContextPolicy(candidate)
  );

  return blocked ? 'That name is not allowed on BOZO.' : '';
}

function validateBozoName(value, label='Name') {
  const reason = bozoNameModerationReason(value);
  return reason ? `${label}: ${reason}` : '';
}


const BOZO_COUNTRIES = [["AF", "Afghanistan"], ["AL", "Albania"], ["DZ", "Algeria"], ["AS", "American Samoa"], ["AD", "Andorra"], ["AO", "Angola"], ["AI", "Anguilla"], ["AQ", "Antarctica"], ["AG", "Antigua and Barbuda"], ["AR", "Argentina"], ["AM", "Armenia"], ["AW", "Aruba"], ["AU", "Australia"], ["AT", "Austria"], ["AZ", "Azerbaijan"], ["BS", "Bahamas"], ["BH", "Bahrain"], ["BD", "Bangladesh"], ["BB", "Barbados"], ["BY", "Belarus"], ["BE", "Belgium"], ["BZ", "Belize"], ["BJ", "Benin"], ["BM", "Bermuda"], ["BT", "Bhutan"], ["BO", "Bolivia, Plurinational State of"], ["BQ", "Bonaire, Sint Eustatius and Saba"], ["BA", "Bosnia and Herzegovina"], ["BW", "Botswana"], ["BV", "Bouvet Island"], ["BR", "Brazil"], ["IO", "British Indian Ocean Territory"], ["BN", "Brunei Darussalam"], ["BG", "Bulgaria"], ["BF", "Burkina Faso"], ["BI", "Burundi"], ["CV", "Cabo Verde"], ["KH", "Cambodia"], ["CM", "Cameroon"], ["CA", "Canada"], ["KY", "Cayman Islands"], ["CF", "Central African Republic"], ["TD", "Chad"], ["CL", "Chile"], ["CN", "China"], ["CX", "Christmas Island"], ["CC", "Cocos (Keeling) Islands"], ["CO", "Colombia"], ["KM", "Comoros"], ["CG", "Congo"], ["CD", "Congo, The Democratic Republic of the"], ["CK", "Cook Islands"], ["CR", "Costa Rica"], ["HR", "Croatia"], ["CU", "Cuba"], ["CW", "Curaçao"], ["CY", "Cyprus"], ["CZ", "Czechia"], ["CI", "Côte d'Ivoire"], ["DK", "Denmark"], ["DJ", "Djibouti"], ["DM", "Dominica"], ["DO", "Dominican Republic"], ["EC", "Ecuador"], ["EG", "Egypt"], ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"], ["EE", "Estonia"], ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["FK", "Falkland Islands (Malvinas)"], ["FO", "Faroe Islands"], ["FJ", "Fiji"], ["FI", "Finland"], ["FR", "France"], ["GF", "French Guiana"], ["PF", "French Polynesia"], ["TF", "French Southern Territories"], ["GA", "Gabon"], ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"], ["GH", "Ghana"], ["GI", "Gibraltar"], ["GR", "Greece"], ["GL", "Greenland"], ["GD", "Grenada"], ["GP", "Guadeloupe"], ["GU", "Guam"], ["GT", "Guatemala"], ["GG", "Guernsey"], ["GN", "Guinea"], ["GW", "Guinea-Bissau"], ["GY", "Guyana"], ["HT", "Haiti"], ["HM", "Heard Island and McDonald Islands"], ["VA", "Holy See (Vatican City State)"], ["HN", "Honduras"], ["HK", "Hong Kong"], ["HU", "Hungary"], ["IS", "Iceland"], ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran, Islamic Republic of"], ["IQ", "Iraq"], ["IE", "Ireland"], ["IM", "Isle of Man"], ["IL", "Israel"], ["IT", "Italy"], ["JM", "Jamaica"], ["JP", "Japan"], ["JE", "Jersey"], ["JO", "Jordan"], ["KZ", "Kazakhstan"], ["KE", "Kenya"], ["KI", "Kiribati"], ["KP", "Korea, Democratic People's Republic of"], ["KR", "Korea, Republic of"], ["KW", "Kuwait"], ["KG", "Kyrgyzstan"], ["LA", "Lao People's Democratic Republic"], ["LV", "Latvia"], ["LB", "Lebanon"], ["LS", "Lesotho"], ["LR", "Liberia"], ["LY", "Libya"], ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"], ["MO", "Macao"], ["MG", "Madagascar"], ["MW", "Malawi"], ["MY", "Malaysia"], ["MV", "Maldives"], ["ML", "Mali"], ["MT", "Malta"], ["MH", "Marshall Islands"], ["MQ", "Martinique"], ["MR", "Mauritania"], ["MU", "Mauritius"], ["YT", "Mayotte"], ["MX", "Mexico"], ["FM", "Micronesia, Federated States of"], ["MD", "Moldova, Republic of"], ["MC", "Monaco"], ["MN", "Mongolia"], ["ME", "Montenegro"], ["MS", "Montserrat"], ["MA", "Morocco"], ["MZ", "Mozambique"], ["MM", "Myanmar"], ["NA", "Namibia"], ["NR", "Nauru"], ["NP", "Nepal"], ["NL", "Netherlands"], ["NC", "New Caledonia"], ["NZ", "New Zealand"], ["NI", "Nicaragua"], ["NE", "Niger"], ["NG", "Nigeria"], ["NU", "Niue"], ["NF", "Norfolk Island"], ["MK", "North Macedonia"], ["MP", "Northern Mariana Islands"], ["NO", "Norway"], ["OM", "Oman"], ["PK", "Pakistan"], ["PW", "Palau"], ["PS", "Palestine, State of"], ["PA", "Panama"], ["PG", "Papua New Guinea"], ["PY", "Paraguay"], ["PE", "Peru"], ["PH", "Philippines"], ["PN", "Pitcairn"], ["PL", "Poland"], ["PT", "Portugal"], ["PR", "Puerto Rico"], ["QA", "Qatar"], ["RO", "Romania"], ["RU", "Russian Federation"], ["RW", "Rwanda"], ["RE", "Réunion"], ["BL", "Saint Barthélemy"], ["SH", "Saint Helena, Ascension and Tristan da Cunha"], ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"], ["MF", "Saint Martin (French part)"], ["PM", "Saint Pierre and Miquelon"], ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"], ["SM", "San Marino"], ["ST", "Sao Tome and Principe"], ["SA", "Saudi Arabia"], ["SN", "Senegal"], ["RS", "Serbia"], ["SC", "Seychelles"], ["SL", "Sierra Leone"], ["SG", "Singapore"], ["SX", "Sint Maarten (Dutch part)"], ["SK", "Slovakia"], ["SI", "Slovenia"], ["SB", "Solomon Islands"], ["SO", "Somalia"], ["ZA", "South Africa"], ["GS", "South Georgia and the South Sandwich Islands"], ["SS", "South Sudan"], ["ES", "Spain"], ["LK", "Sri Lanka"], ["SD", "Sudan"], ["SR", "Suriname"], ["SJ", "Svalbard and Jan Mayen"], ["SE", "Sweden"], ["CH", "Switzerland"], ["SY", "Syrian Arab Republic"], ["TW", "Taiwan, Province of China"], ["TJ", "Tajikistan"], ["TZ", "Tanzania, United Republic of"], ["TH", "Thailand"], ["TL", "Timor-Leste"], ["TG", "Togo"], ["TK", "Tokelau"], ["TO", "Tonga"], ["TT", "Trinidad and Tobago"], ["TN", "Tunisia"], ["TM", "Turkmenistan"], ["TC", "Turks and Caicos Islands"], ["TV", "Tuvalu"], ["TR", "Türkiye"], ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"], ["US", "United States"], ["UM", "United States Minor Outlying Islands"], ["UY", "Uruguay"], ["UZ", "Uzbekistan"], ["VU", "Vanuatu"], ["VE", "Venezuela, Bolivarian Republic of"], ["VN", "Viet Nam"], ["VG", "Virgin Islands, British"], ["VI", "Virgin Islands, U.S."], ["WF", "Wallis and Futuna"], ["EH", "Western Sahara"], ["YE", "Yemen"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"], ["AX", "Åland Islands"]];
const BOZO_FREE_FLAIRS = new Set(['','pawn','knight','bishop','rook','queen','king']);
const BOZO_PLUS_FLAIRS = new Set(['supporter','scholar','crown','fire']);
const BOZO_FLAIR_SYMBOLS = {
  pawn:'♟', knight:'♞', bishop:'♝', rook:'♜', queen:'♛', king:'♚',
  crown:'👑', fire:'🔥'
};

function countryFlag(code='') {
  const value = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return '';
  return String.fromCodePoint(...[...value].map(ch => 127397 + ch.charCodeAt(0)));
}

function countryFlagImage(code='', className='country-flag-image') {
  const value = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return '';
  const lower = value.toLowerCase();
  return `<img class="${className}" src="https://flagcdn.com/24x18/${lower}.png" srcset="https://flagcdn.com/48x36/${lower}.png 2x" alt="${value} flag" loading="lazy" referrerpolicy="no-referrer">`;
}

function populateCountrySelector() {
  const select = $('profile-country-input');
  if (!select || select.dataset.ready === '1') return;

  for (const [code,name] of BOZO_COUNTRIES) {
    const option = document.createElement('option');
    option.value = code;
    option.dataset.search = `${name} ${code}`.toLowerCase();
    option.textContent = `${countryFlag(code)} ${name}`;
    select.appendChild(option);
  }

  const search = $('profile-country-search');
  if (search && !search.dataset.bound) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let firstVisible = null;

      [...select.options].forEach((option, index) => {
        if (index === 0) {
          option.hidden = false;
          return;
        }
        const match = !q || String(option.dataset.search || option.textContent).toLowerCase().includes(q);
        option.hidden = !match;
        if (match && !firstVisible) firstVisible = option;
      });

      // Keep the current selection if it still matches; otherwise preview the first result.
      const current = select.selectedOptions[0];
      if (q && current?.hidden && firstVisible) select.value = firstVisible.value;
    });
    search.dataset.bound = '1';
  }

  select.dataset.ready = '1';
}

function flairMarkup(profile={}) {
  if (profile.emoji_flair && !BOZO_BLOCKED_EMOJI.has(profile.emoji_flair)) {
    return `<span class="name-flair-symbol" title="Emoji flair">${escapeHtml(profile.emoji_flair)}</span>`;
  }
  const flair = String(profile.selected_flair || '');
  if (!flair) return '';
  if (flair === 'supporter') return '<img class="name-flair-image" src="./assets/bozo-supporter.png" alt="Supporter flair">';
  if (flair === 'scholar') return '<img class="name-flair-image" src="./assets/bozo-scholar.png" alt="Scholar BOZO flair">';
  return BOZO_FLAIR_SYMBOLS[flair] ? `<span class="name-flair-symbol" title="${escapeHtml(flair)}">${BOZO_FLAIR_SYMBOLS[flair]}</span>` : '';
}

function compactIdentityBadges(profile={}, role='') {
  const bits = [];
  if (profile.chess_title) bits.push(`<span class="live-title-badge">${escapeHtml(profile.chess_title)}</span>`);
  if (profile.bozo_title) bits.push(`<span class="live-title-badge bozo">${escapeHtml(profile.bozo_title)}</span>`);
  if (role === 'owner') bits.push('<span class="live-role-badge owner" title="BOZO Owner">♛</span>');
  else if (['administrator','senior_moderator','moderator','reviewer','staff'].includes(role)) bits.push('<span class="live-role-badge staff" title="BOZO Staff">♜</span>');
  if (profile.identity_verified) bits.push('<span class="live-verified-badge" title="Identity verified by BOZO">✓</span>');
  if (profile.country_code) bits.push(`<span class="live-country-flag" title="${escapeHtml(profile.country_code)}">${countryFlagImage(profile.country_code,'live-country-flag-img')}</span>`);
  bits.push(flairMarkup(profile));
  return bits.join('');
}

function paintProfileRoleFlair(role) {
  const el = $('profile-role-flair');
  if (!el) return;
  if (role === 'owner') {
    el.src = './assets/bozo-owner-flair.png';
    el.alt = 'BOZO Owner flair';
    el.hidden = false;
  } else if (['administrator','senior_moderator','moderator','reviewer','staff'].includes(role)) {
    el.src = './assets/bozo-staff-flair.png';
    el.alt = 'BOZO Staff flair';
    el.hidden = false;
  } else {
    el.hidden = true;
    el.removeAttribute('src');
  }
}


const BOZO_EMOJI_FLAIRS = [{"emoji": "😀", "category": "Smileys"}, {"emoji": "😃", "category": "Smileys"}, {"emoji": "😄", "category": "Smileys"}, {"emoji": "😁", "category": "Smileys"}, {"emoji": "😆", "category": "Smileys"}, {"emoji": "😅", "category": "Smileys"}, {"emoji": "😂", "category": "Smileys"}, {"emoji": "🤣", "category": "Smileys"}, {"emoji": "😊", "category": "Smileys"}, {"emoji": "😇", "category": "Smileys"}, {"emoji": "🙂", "category": "Smileys"}, {"emoji": "🙃", "category": "Smileys"}, {"emoji": "😉", "category": "Smileys"}, {"emoji": "😌", "category": "Smileys"}, {"emoji": "😍", "category": "Smileys"}, {"emoji": "🥰", "category": "Smileys"}, {"emoji": "😘", "category": "Smileys"}, {"emoji": "😋", "category": "Smileys"}, {"emoji": "😛", "category": "Smileys"}, {"emoji": "😜", "category": "Smileys"}, {"emoji": "🤪", "category": "Smileys"}, {"emoji": "🤨", "category": "Smileys"}, {"emoji": "🧐", "category": "Smileys"}, {"emoji": "🤓", "category": "Smileys"}, {"emoji": "😎", "category": "Smileys"}, {"emoji": "🥸", "category": "Smileys"}, {"emoji": "🤩", "category": "Smileys"}, {"emoji": "🥳", "category": "Smileys"}, {"emoji": "😏", "category": "Smileys"}, {"emoji": "😒", "category": "Smileys"}, {"emoji": "😞", "category": "Smileys"}, {"emoji": "😔", "category": "Smileys"}, {"emoji": "😟", "category": "Smileys"}, {"emoji": "😕", "category": "Smileys"}, {"emoji": "🙁", "category": "Smileys"}, {"emoji": "☹️", "category": "Smileys"}, {"emoji": "😣", "category": "Smileys"}, {"emoji": "😖", "category": "Smileys"}, {"emoji": "😫", "category": "Smileys"}, {"emoji": "😩", "category": "Smileys"}, {"emoji": "🥺", "category": "Smileys"}, {"emoji": "😢", "category": "Smileys"}, {"emoji": "😭", "category": "Smileys"}, {"emoji": "😤", "category": "Smileys"}, {"emoji": "😠", "category": "Smileys"}, {"emoji": "😡", "category": "Smileys"}, {"emoji": "🤯", "category": "Smileys"}, {"emoji": "😳", "category": "Smileys"}, {"emoji": "🥵", "category": "Smileys"}, {"emoji": "🥶", "category": "Smileys"}, {"emoji": "😱", "category": "Smileys"}, {"emoji": "😨", "category": "Smileys"}, {"emoji": "😰", "category": "Smileys"}, {"emoji": "😥", "category": "Smileys"}, {"emoji": "😓", "category": "Smileys"}, {"emoji": "🤔", "category": "Smileys"}, {"emoji": "🤭", "category": "Smileys"}, {"emoji": "🤫", "category": "Smileys"}, {"emoji": "🤥", "category": "Smileys"}, {"emoji": "😶", "category": "Smileys"}, {"emoji": "😐", "category": "Smileys"}, {"emoji": "😑", "category": "Smileys"}, {"emoji": "😬", "category": "Smileys"}, {"emoji": "🙄", "category": "Smileys"}, {"emoji": "😯", "category": "Smileys"}, {"emoji": "😦", "category": "Smileys"}, {"emoji": "😧", "category": "Smileys"}, {"emoji": "😮", "category": "Smileys"}, {"emoji": "😲", "category": "Smileys"}, {"emoji": "🥱", "category": "Smileys"}, {"emoji": "😴", "category": "Smileys"}, {"emoji": "🤤", "category": "Smileys"}, {"emoji": "😪", "category": "Smileys"}, {"emoji": "😵", "category": "Smileys"}, {"emoji": "🤐", "category": "Smileys"}, {"emoji": "🥴", "category": "Smileys"}, {"emoji": "🤢", "category": "Smileys"}, {"emoji": "🤮", "category": "Smileys"}, {"emoji": "🤧", "category": "Smileys"}, {"emoji": "😷", "category": "Smileys"}, {"emoji": "🤒", "category": "Smileys"}, {"emoji": "🤕", "category": "Smileys"}, {"emoji": "🤑", "category": "Smileys"}, {"emoji": "🤠", "category": "Smileys"}, {"emoji": "😈", "category": "Smileys"}, {"emoji": "👿", "category": "Smileys"}, {"emoji": "👹", "category": "Smileys"}, {"emoji": "👺", "category": "Smileys"}, {"emoji": "🤡", "category": "Smileys"}, {"emoji": "💩", "category": "Smileys"}, {"emoji": "👻", "category": "Smileys"}, {"emoji": "💀", "category": "Smileys"}, {"emoji": "☠️", "category": "Smileys"}, {"emoji": "👽", "category": "Smileys"}, {"emoji": "👾", "category": "Smileys"}, {"emoji": "🤖", "category": "Smileys"}, {"emoji": "🎃", "category": "Smileys"}, {"emoji": "👋", "category": "Gestures"}, {"emoji": "🤚", "category": "Gestures"}, {"emoji": "🖐️", "category": "Gestures"}, {"emoji": "✋", "category": "Gestures"}, {"emoji": "🖖", "category": "Gestures"}, {"emoji": "👌", "category": "Gestures"}, {"emoji": "🤌", "category": "Gestures"}, {"emoji": "🤏", "category": "Gestures"}, {"emoji": "✌️", "category": "Gestures"}, {"emoji": "🤞", "category": "Gestures"}, {"emoji": "🤟", "category": "Gestures"}, {"emoji": "🤘", "category": "Gestures"}, {"emoji": "🤙", "category": "Gestures"}, {"emoji": "🫵", "category": "Gestures"}, {"emoji": "👈", "category": "Gestures"}, {"emoji": "👉", "category": "Gestures"}, {"emoji": "👆", "category": "Gestures"}, {"emoji": "👇", "category": "Gestures"}, {"emoji": "☝️", "category": "Gestures"}, {"emoji": "👍", "category": "Gestures"}, {"emoji": "👎", "category": "Gestures"}, {"emoji": "✊", "category": "Gestures"}, {"emoji": "👊", "category": "Gestures"}, {"emoji": "🤛", "category": "Gestures"}, {"emoji": "🤜", "category": "Gestures"}, {"emoji": "👏", "category": "Gestures"}, {"emoji": "🫶", "category": "Gestures"}, {"emoji": "🙌", "category": "Gestures"}, {"emoji": "👐", "category": "Gestures"}, {"emoji": "🤲", "category": "Gestures"}, {"emoji": "🤝", "category": "Gestures"}, {"emoji": "🙏", "category": "Gestures"}, {"emoji": "✍️", "category": "Gestures"}, {"emoji": "💅", "category": "Gestures"}, {"emoji": "🤳", "category": "Gestures"}, {"emoji": "💪", "category": "Gestures"}, {"emoji": "🐶", "category": "Animals"}, {"emoji": "🐱", "category": "Animals"}, {"emoji": "🐭", "category": "Animals"}, {"emoji": "🐹", "category": "Animals"}, {"emoji": "🐰", "category": "Animals"}, {"emoji": "🦊", "category": "Animals"}, {"emoji": "🐻", "category": "Animals"}, {"emoji": "🐼", "category": "Animals"}, {"emoji": "🐻‍❄️", "category": "Animals"}, {"emoji": "🐨", "category": "Animals"}, {"emoji": "🐯", "category": "Animals"}, {"emoji": "🦁", "category": "Animals"}, {"emoji": "🐮", "category": "Animals"}, {"emoji": "🐷", "category": "Animals"}, {"emoji": "🐸", "category": "Animals"}, {"emoji": "🐵", "category": "Animals"}, {"emoji": "🐔", "category": "Animals"}, {"emoji": "🐧", "category": "Animals"}, {"emoji": "🐦", "category": "Animals"}, {"emoji": "🐤", "category": "Animals"}, {"emoji": "🦆", "category": "Animals"}, {"emoji": "🦅", "category": "Animals"}, {"emoji": "🦉", "category": "Animals"}, {"emoji": "🦇", "category": "Animals"}, {"emoji": "🐺", "category": "Animals"}, {"emoji": "🐗", "category": "Animals"}, {"emoji": "🐴", "category": "Animals"}, {"emoji": "🦄", "category": "Animals"}, {"emoji": "🐝", "category": "Animals"}, {"emoji": "🪱", "category": "Animals"}, {"emoji": "🐛", "category": "Animals"}, {"emoji": "🦋", "category": "Animals"}, {"emoji": "🐌", "category": "Animals"}, {"emoji": "🐞", "category": "Animals"}, {"emoji": "🐜", "category": "Animals"}, {"emoji": "🪰", "category": "Animals"}, {"emoji": "🪲", "category": "Animals"}, {"emoji": "🪳", "category": "Animals"}, {"emoji": "🦟", "category": "Animals"}, {"emoji": "🦗", "category": "Animals"}, {"emoji": "🕷️", "category": "Animals"}, {"emoji": "🦂", "category": "Animals"}, {"emoji": "🐢", "category": "Animals"}, {"emoji": "🐍", "category": "Animals"}, {"emoji": "🦎", "category": "Animals"}, {"emoji": "🐙", "category": "Animals"}, {"emoji": "🦑", "category": "Animals"}, {"emoji": "🦐", "category": "Animals"}, {"emoji": "🦞", "category": "Animals"}, {"emoji": "🦀", "category": "Animals"}, {"emoji": "🐡", "category": "Animals"}, {"emoji": "🐠", "category": "Animals"}, {"emoji": "🐟", "category": "Animals"}, {"emoji": "🐬", "category": "Animals"}, {"emoji": "🐳", "category": "Animals"}, {"emoji": "🐋", "category": "Animals"}, {"emoji": "🦈", "category": "Animals"}, {"emoji": "🐊", "category": "Animals"}, {"emoji": "🐅", "category": "Animals"}, {"emoji": "🐆", "category": "Animals"}, {"emoji": "🦓", "category": "Animals"}, {"emoji": "🦍", "category": "Animals"}, {"emoji": "🦧", "category": "Animals"}, {"emoji": "🐘", "category": "Animals"}, {"emoji": "🦛", "category": "Animals"}, {"emoji": "🦏", "category": "Animals"}, {"emoji": "🐪", "category": "Animals"}, {"emoji": "🐫", "category": "Animals"}, {"emoji": "🦒", "category": "Animals"}, {"emoji": "🦬", "category": "Animals"}, {"emoji": "🐃", "category": "Animals"}, {"emoji": "🐂", "category": "Animals"}, {"emoji": "🐄", "category": "Animals"}, {"emoji": "🐎", "category": "Animals"}, {"emoji": "🐖", "category": "Animals"}, {"emoji": "🐏", "category": "Animals"}, {"emoji": "🐑", "category": "Animals"}, {"emoji": "🦙", "category": "Animals"}, {"emoji": "🐐", "category": "Animals"}, {"emoji": "🦌", "category": "Animals"}, {"emoji": "🐕", "category": "Animals"}, {"emoji": "🐩", "category": "Animals"}, {"emoji": "🦮", "category": "Animals"}, {"emoji": "🐕‍🦺", "category": "Animals"}, {"emoji": "🐈", "category": "Animals"}, {"emoji": "🐈‍⬛", "category": "Animals"}, {"emoji": "🪶", "category": "Animals"}, {"emoji": "🐓", "category": "Animals"}, {"emoji": "🦃", "category": "Animals"}, {"emoji": "🦚", "category": "Animals"}, {"emoji": "🦜", "category": "Animals"}, {"emoji": "🦢", "category": "Animals"}, {"emoji": "🦩", "category": "Animals"}, {"emoji": "🕊️", "category": "Animals"}, {"emoji": "🐇", "category": "Animals"}, {"emoji": "🦝", "category": "Animals"}, {"emoji": "🦨", "category": "Animals"}, {"emoji": "🦡", "category": "Animals"}, {"emoji": "🦫", "category": "Animals"}, {"emoji": "🦦", "category": "Animals"}, {"emoji": "🦥", "category": "Animals"}, {"emoji": "🐁", "category": "Animals"}, {"emoji": "🐀", "category": "Animals"}, {"emoji": "🐿️", "category": "Animals"}, {"emoji": "🦔", "category": "Animals"}, {"emoji": "🍏", "category": "Food"}, {"emoji": "🍎", "category": "Food"}, {"emoji": "🍐", "category": "Food"}, {"emoji": "🍊", "category": "Food"}, {"emoji": "🍋", "category": "Food"}, {"emoji": "🍌", "category": "Food"}, {"emoji": "🍉", "category": "Food"}, {"emoji": "🍇", "category": "Food"}, {"emoji": "🍓", "category": "Food"}, {"emoji": "🫐", "category": "Food"}, {"emoji": "🍈", "category": "Food"}, {"emoji": "🍒", "category": "Food"}, {"emoji": "🍑", "category": "Food"}, {"emoji": "🥭", "category": "Food"}, {"emoji": "🍍", "category": "Food"}, {"emoji": "🥥", "category": "Food"}, {"emoji": "🥝", "category": "Food"}, {"emoji": "🍅", "category": "Food"}, {"emoji": "🍆", "category": "Food"}, {"emoji": "🥑", "category": "Food"}, {"emoji": "🥦", "category": "Food"}, {"emoji": "🥬", "category": "Food"}, {"emoji": "🥒", "category": "Food"}, {"emoji": "🌶️", "category": "Food"}, {"emoji": "🫑", "category": "Food"}, {"emoji": "🌽", "category": "Food"}, {"emoji": "🥕", "category": "Food"}, {"emoji": "🫒", "category": "Food"}, {"emoji": "🧄", "category": "Food"}, {"emoji": "🧅", "category": "Food"}, {"emoji": "🥔", "category": "Food"}, {"emoji": "🍠", "category": "Food"}, {"emoji": "🥐", "category": "Food"}, {"emoji": "🥯", "category": "Food"}, {"emoji": "🍞", "category": "Food"}, {"emoji": "🥖", "category": "Food"}, {"emoji": "🥨", "category": "Food"}, {"emoji": "🧀", "category": "Food"}, {"emoji": "🥚", "category": "Food"}, {"emoji": "🍳", "category": "Food"}, {"emoji": "🧈", "category": "Food"}, {"emoji": "🥞", "category": "Food"}, {"emoji": "🧇", "category": "Food"}, {"emoji": "🥓", "category": "Food"}, {"emoji": "🥩", "category": "Food"}, {"emoji": "🍗", "category": "Food"}, {"emoji": "🍖", "category": "Food"}, {"emoji": "🌭", "category": "Food"}, {"emoji": "🍔", "category": "Food"}, {"emoji": "🍟", "category": "Food"}, {"emoji": "🍕", "category": "Food"}, {"emoji": "🫓", "category": "Food"}, {"emoji": "🥪", "category": "Food"}, {"emoji": "🥙", "category": "Food"}, {"emoji": "🧆", "category": "Food"}, {"emoji": "🌮", "category": "Food"}, {"emoji": "🌯", "category": "Food"}, {"emoji": "🫔", "category": "Food"}, {"emoji": "🥗", "category": "Food"}, {"emoji": "🥘", "category": "Food"}, {"emoji": "🫕", "category": "Food"}, {"emoji": "🥫", "category": "Food"}, {"emoji": "🍝", "category": "Food"}, {"emoji": "🍜", "category": "Food"}, {"emoji": "🍲", "category": "Food"}, {"emoji": "🍛", "category": "Food"}, {"emoji": "🍣", "category": "Food"}, {"emoji": "🍱", "category": "Food"}, {"emoji": "🥟", "category": "Food"}, {"emoji": "🦪", "category": "Food"}, {"emoji": "🍤", "category": "Food"}, {"emoji": "🍙", "category": "Food"}, {"emoji": "🍚", "category": "Food"}, {"emoji": "🍘", "category": "Food"}, {"emoji": "🍥", "category": "Food"}, {"emoji": "🥠", "category": "Food"}, {"emoji": "🥮", "category": "Food"}, {"emoji": "🍢", "category": "Food"}, {"emoji": "🍡", "category": "Food"}, {"emoji": "🍧", "category": "Food"}, {"emoji": "🍨", "category": "Food"}, {"emoji": "🍦", "category": "Food"}, {"emoji": "🥧", "category": "Food"}, {"emoji": "🧁", "category": "Food"}, {"emoji": "🍰", "category": "Food"}, {"emoji": "🎂", "category": "Food"}, {"emoji": "🍮", "category": "Food"}, {"emoji": "🍭", "category": "Food"}, {"emoji": "🍬", "category": "Food"}, {"emoji": "🍫", "category": "Food"}, {"emoji": "🍿", "category": "Food"}, {"emoji": "🍩", "category": "Food"}, {"emoji": "🍪", "category": "Food"}, {"emoji": "🌰", "category": "Food"}, {"emoji": "🥜", "category": "Food"}, {"emoji": "🍯", "category": "Food"}, {"emoji": "⚽", "category": "Activities"}, {"emoji": "🏀", "category": "Activities"}, {"emoji": "🏈", "category": "Activities"}, {"emoji": "⚾", "category": "Activities"}, {"emoji": "🥎", "category": "Activities"}, {"emoji": "🎾", "category": "Activities"}, {"emoji": "🏐", "category": "Activities"}, {"emoji": "🏉", "category": "Activities"}, {"emoji": "🥏", "category": "Activities"}, {"emoji": "🎱", "category": "Activities"}, {"emoji": "🪀", "category": "Activities"}, {"emoji": "🏓", "category": "Activities"}, {"emoji": "🏸", "category": "Activities"}, {"emoji": "🏒", "category": "Activities"}, {"emoji": "🏑", "category": "Activities"}, {"emoji": "🥍", "category": "Activities"}, {"emoji": "🏏", "category": "Activities"}, {"emoji": "🪃", "category": "Activities"}, {"emoji": "🥅", "category": "Activities"}, {"emoji": "⛳", "category": "Activities"}, {"emoji": "🪁", "category": "Activities"}, {"emoji": "🏹", "category": "Activities"}, {"emoji": "🎣", "category": "Activities"}, {"emoji": "🤿", "category": "Activities"}, {"emoji": "🥊", "category": "Activities"}, {"emoji": "🥋", "category": "Activities"}, {"emoji": "🎽", "category": "Activities"}, {"emoji": "🛹", "category": "Activities"}, {"emoji": "🛼", "category": "Activities"}, {"emoji": "🛷", "category": "Activities"}, {"emoji": "⛸️", "category": "Activities"}, {"emoji": "🥌", "category": "Activities"}, {"emoji": "🎿", "category": "Activities"}, {"emoji": "⛷️", "category": "Activities"}, {"emoji": "🏂", "category": "Activities"}, {"emoji": "🪂", "category": "Activities"}, {"emoji": "🏋️", "category": "Activities"}, {"emoji": "🤼", "category": "Activities"}, {"emoji": "🤸", "category": "Activities"}, {"emoji": "⛹️", "category": "Activities"}, {"emoji": "🤺", "category": "Activities"}, {"emoji": "🤾", "category": "Activities"}, {"emoji": "🏌️", "category": "Activities"}, {"emoji": "🏇", "category": "Activities"}, {"emoji": "🧘", "category": "Activities"}, {"emoji": "🏄", "category": "Activities"}, {"emoji": "🏊", "category": "Activities"}, {"emoji": "🤽", "category": "Activities"}, {"emoji": "🚣", "category": "Activities"}, {"emoji": "🧗", "category": "Activities"}, {"emoji": "🚵", "category": "Activities"}, {"emoji": "🚴", "category": "Activities"}, {"emoji": "🏆", "category": "Activities"}, {"emoji": "🥇", "category": "Activities"}, {"emoji": "🥈", "category": "Activities"}, {"emoji": "🥉", "category": "Activities"}, {"emoji": "🏅", "category": "Activities"}, {"emoji": "🎖️", "category": "Activities"}, {"emoji": "🏵️", "category": "Activities"}, {"emoji": "🎗️", "category": "Activities"}, {"emoji": "🎫", "category": "Activities"}, {"emoji": "🎟️", "category": "Activities"}, {"emoji": "🎪", "category": "Activities"}, {"emoji": "🤹", "category": "Activities"}, {"emoji": "🎭", "category": "Activities"}, {"emoji": "🩰", "category": "Activities"}, {"emoji": "🎨", "category": "Activities"}, {"emoji": "🎬", "category": "Activities"}, {"emoji": "🎤", "category": "Activities"}, {"emoji": "🎧", "category": "Activities"}, {"emoji": "🎼", "category": "Activities"}, {"emoji": "🎹", "category": "Activities"}, {"emoji": "🥁", "category": "Activities"}, {"emoji": "🪘", "category": "Activities"}, {"emoji": "🎷", "category": "Activities"}, {"emoji": "🎺", "category": "Activities"}, {"emoji": "🪗", "category": "Activities"}, {"emoji": "🎸", "category": "Activities"}, {"emoji": "🪕", "category": "Activities"}, {"emoji": "🎻", "category": "Activities"}, {"emoji": "🚗", "category": "Travel"}, {"emoji": "🚕", "category": "Travel"}, {"emoji": "🚙", "category": "Travel"}, {"emoji": "🚌", "category": "Travel"}, {"emoji": "🚎", "category": "Travel"}, {"emoji": "🏎️", "category": "Travel"}, {"emoji": "🚓", "category": "Travel"}, {"emoji": "🚑", "category": "Travel"}, {"emoji": "🚒", "category": "Travel"}, {"emoji": "🚐", "category": "Travel"}, {"emoji": "🛻", "category": "Travel"}, {"emoji": "🚚", "category": "Travel"}, {"emoji": "🚛", "category": "Travel"}, {"emoji": "🚜", "category": "Travel"}, {"emoji": "🏍️", "category": "Travel"}, {"emoji": "🛵", "category": "Travel"}, {"emoji": "🚲", "category": "Travel"}, {"emoji": "🛴", "category": "Travel"}, {"emoji": "🚨", "category": "Travel"}, {"emoji": "🚔", "category": "Travel"}, {"emoji": "🚍", "category": "Travel"}, {"emoji": "🚘", "category": "Travel"}, {"emoji": "🚖", "category": "Travel"}, {"emoji": "✈️", "category": "Travel"}, {"emoji": "🛫", "category": "Travel"}, {"emoji": "🛬", "category": "Travel"}, {"emoji": "🛩️", "category": "Travel"}, {"emoji": "💺", "category": "Travel"}, {"emoji": "🚁", "category": "Travel"}, {"emoji": "🚟", "category": "Travel"}, {"emoji": "🚠", "category": "Travel"}, {"emoji": "🚡", "category": "Travel"}, {"emoji": "🛰️", "category": "Travel"}, {"emoji": "🚀", "category": "Travel"}, {"emoji": "🛸", "category": "Travel"}, {"emoji": "🚆", "category": "Travel"}, {"emoji": "🚄", "category": "Travel"}, {"emoji": "🚅", "category": "Travel"}, {"emoji": "🚈", "category": "Travel"}, {"emoji": "🚂", "category": "Travel"}, {"emoji": "🚇", "category": "Travel"}, {"emoji": "🚊", "category": "Travel"}, {"emoji": "🚉", "category": "Travel"}, {"emoji": "🚢", "category": "Travel"}, {"emoji": "⛵", "category": "Travel"}, {"emoji": "🚤", "category": "Travel"}, {"emoji": "🛥️", "category": "Travel"}, {"emoji": "🛳️", "category": "Travel"}, {"emoji": "⛴️", "category": "Travel"}, {"emoji": "⚓", "category": "Travel"}, {"emoji": "🪝", "category": "Travel"}, {"emoji": "⛽", "category": "Travel"}, {"emoji": "🚧", "category": "Travel"}, {"emoji": "🚦", "category": "Travel"}, {"emoji": "🚥", "category": "Travel"}, {"emoji": "🗺️", "category": "Travel"}, {"emoji": "🗿", "category": "Travel"}, {"emoji": "🗽", "category": "Travel"}, {"emoji": "🗼", "category": "Travel"}, {"emoji": "🏰", "category": "Travel"}, {"emoji": "🏯", "category": "Travel"}, {"emoji": "🏟️", "category": "Travel"}, {"emoji": "🎡", "category": "Travel"}, {"emoji": "🎢", "category": "Travel"}, {"emoji": "🎠", "category": "Travel"}, {"emoji": "⛲", "category": "Travel"}, {"emoji": "⛱️", "category": "Travel"}, {"emoji": "🏖️", "category": "Travel"}, {"emoji": "🏝️", "category": "Travel"}, {"emoji": "🏜️", "category": "Travel"}, {"emoji": "🌋", "category": "Travel"}, {"emoji": "⛰️", "category": "Travel"}, {"emoji": "🏕️", "category": "Travel"}, {"emoji": "⛺", "category": "Travel"}, {"emoji": "🛖", "category": "Travel"}, {"emoji": "🏠", "category": "Travel"}, {"emoji": "🏡", "category": "Travel"}, {"emoji": "🏢", "category": "Travel"}, {"emoji": "🏥", "category": "Travel"}, {"emoji": "🏦", "category": "Travel"}, {"emoji": "🏨", "category": "Travel"}, {"emoji": "🏪", "category": "Travel"}, {"emoji": "🏫", "category": "Travel"}, {"emoji": "⌚", "category": "Objects"}, {"emoji": "📱", "category": "Objects"}, {"emoji": "💻", "category": "Objects"}, {"emoji": "⌨️", "category": "Objects"}, {"emoji": "🖥️", "category": "Objects"}, {"emoji": "🖨️", "category": "Objects"}, {"emoji": "🖱️", "category": "Objects"}, {"emoji": "💽", "category": "Objects"}, {"emoji": "💾", "category": "Objects"}, {"emoji": "💿", "category": "Objects"}, {"emoji": "📀", "category": "Objects"}, {"emoji": "🧮", "category": "Objects"}, {"emoji": "🎥", "category": "Objects"}, {"emoji": "🎞️", "category": "Objects"}, {"emoji": "📽️", "category": "Objects"}, {"emoji": "🎬", "category": "Objects"}, {"emoji": "📺", "category": "Objects"}, {"emoji": "📷", "category": "Objects"}, {"emoji": "📸", "category": "Objects"}, {"emoji": "📹", "category": "Objects"}, {"emoji": "📼", "category": "Objects"}, {"emoji": "🔍", "category": "Objects"}, {"emoji": "🔎", "category": "Objects"}, {"emoji": "💡", "category": "Objects"}, {"emoji": "🔦", "category": "Objects"}, {"emoji": "🏮", "category": "Objects"}, {"emoji": "🪔", "category": "Objects"}, {"emoji": "📔", "category": "Objects"}, {"emoji": "📕", "category": "Objects"}, {"emoji": "📖", "category": "Objects"}, {"emoji": "📗", "category": "Objects"}, {"emoji": "📘", "category": "Objects"}, {"emoji": "📙", "category": "Objects"}, {"emoji": "📚", "category": "Objects"}, {"emoji": "📓", "category": "Objects"}, {"emoji": "📒", "category": "Objects"}, {"emoji": "📃", "category": "Objects"}, {"emoji": "📜", "category": "Objects"}, {"emoji": "📄", "category": "Objects"}, {"emoji": "📰", "category": "Objects"}, {"emoji": "🗞️", "category": "Objects"}, {"emoji": "📑", "category": "Objects"}, {"emoji": "🔖", "category": "Objects"}, {"emoji": "🏷️", "category": "Objects"}, {"emoji": "💰", "category": "Objects"}, {"emoji": "🪙", "category": "Objects"}, {"emoji": "💴", "category": "Objects"}, {"emoji": "💵", "category": "Objects"}, {"emoji": "💶", "category": "Objects"}, {"emoji": "💷", "category": "Objects"}, {"emoji": "💸", "category": "Objects"}, {"emoji": "💳", "category": "Objects"}, {"emoji": "🧾", "category": "Objects"}, {"emoji": "✉️", "category": "Objects"}, {"emoji": "📧", "category": "Objects"}, {"emoji": "📨", "category": "Objects"}, {"emoji": "📩", "category": "Objects"}, {"emoji": "📤", "category": "Objects"}, {"emoji": "📥", "category": "Objects"}, {"emoji": "📦", "category": "Objects"}, {"emoji": "📫", "category": "Objects"}, {"emoji": "📪", "category": "Objects"}, {"emoji": "📬", "category": "Objects"}, {"emoji": "📭", "category": "Objects"}, {"emoji": "📮", "category": "Objects"}, {"emoji": "🗳️", "category": "Objects"}, {"emoji": "✏️", "category": "Objects"}, {"emoji": "✒️", "category": "Objects"}, {"emoji": "🖋️", "category": "Objects"}, {"emoji": "🖊️", "category": "Objects"}, {"emoji": "🖌️", "category": "Objects"}, {"emoji": "🖍️", "category": "Objects"}, {"emoji": "📝", "category": "Objects"}, {"emoji": "💼", "category": "Objects"}, {"emoji": "📁", "category": "Objects"}, {"emoji": "📂", "category": "Objects"}, {"emoji": "🗂️", "category": "Objects"}, {"emoji": "📅", "category": "Objects"}, {"emoji": "📆", "category": "Objects"}, {"emoji": "🗒️", "category": "Objects"}, {"emoji": "🗓️", "category": "Objects"}, {"emoji": "📇", "category": "Objects"}, {"emoji": "📈", "category": "Objects"}, {"emoji": "📉", "category": "Objects"}, {"emoji": "📊", "category": "Objects"}, {"emoji": "📋", "category": "Objects"}, {"emoji": "📌", "category": "Objects"}, {"emoji": "📍", "category": "Objects"}, {"emoji": "📎", "category": "Objects"}, {"emoji": "🖇️", "category": "Objects"}, {"emoji": "📏", "category": "Objects"}, {"emoji": "📐", "category": "Objects"}, {"emoji": "✂️", "category": "Objects"}, {"emoji": "🗃️", "category": "Objects"}, {"emoji": "🗄️", "category": "Objects"}, {"emoji": "🗑️", "category": "Objects"}, {"emoji": "🔒", "category": "Objects"}, {"emoji": "🔓", "category": "Objects"}, {"emoji": "🔏", "category": "Objects"}, {"emoji": "🔐", "category": "Objects"}, {"emoji": "🔑", "category": "Objects"}, {"emoji": "🗝️", "category": "Objects"}, {"emoji": "🔨", "category": "Objects"}, {"emoji": "🪓", "category": "Objects"}, {"emoji": "⛏️", "category": "Objects"}, {"emoji": "⚒️", "category": "Objects"}, {"emoji": "🛠️", "category": "Objects"}, {"emoji": "🗡️", "category": "Objects"}, {"emoji": "⚔️", "category": "Objects"}, {"emoji": "🛡️", "category": "Objects"}, {"emoji": "🔧", "category": "Objects"}, {"emoji": "🪛", "category": "Objects"}, {"emoji": "🔩", "category": "Objects"}, {"emoji": "⚙️", "category": "Objects"}, {"emoji": "🧱", "category": "Objects"}, {"emoji": "⛓️", "category": "Objects"}, {"emoji": "🧲", "category": "Objects"}, {"emoji": "🔫", "category": "Objects"}, {"emoji": "💣", "category": "Objects"}, {"emoji": "🧨", "category": "Objects"}, {"emoji": "🪓", "category": "Objects"}, {"emoji": "❤️", "category": "Symbols"}, {"emoji": "🧡", "category": "Symbols"}, {"emoji": "💛", "category": "Symbols"}, {"emoji": "💚", "category": "Symbols"}, {"emoji": "💙", "category": "Symbols"}, {"emoji": "💜", "category": "Symbols"}, {"emoji": "🖤", "category": "Symbols"}, {"emoji": "🤍", "category": "Symbols"}, {"emoji": "🤎", "category": "Symbols"}, {"emoji": "💔", "category": "Symbols"}, {"emoji": "❣️", "category": "Symbols"}, {"emoji": "💕", "category": "Symbols"}, {"emoji": "💞", "category": "Symbols"}, {"emoji": "💓", "category": "Symbols"}, {"emoji": "💗", "category": "Symbols"}, {"emoji": "💖", "category": "Symbols"}, {"emoji": "💘", "category": "Symbols"}, {"emoji": "💝", "category": "Symbols"}, {"emoji": "💟", "category": "Symbols"}, {"emoji": "☮️", "category": "Symbols"}, {"emoji": "✝️", "category": "Symbols"}, {"emoji": "☪️", "category": "Symbols"}, {"emoji": "🕉️", "category": "Symbols"}, {"emoji": "☸️", "category": "Symbols"}, {"emoji": "✡️", "category": "Symbols"}, {"emoji": "🔯", "category": "Symbols"}, {"emoji": "🕎", "category": "Symbols"}, {"emoji": "☯️", "category": "Symbols"}, {"emoji": "☦️", "category": "Symbols"}, {"emoji": "🛐", "category": "Symbols"}, {"emoji": "⛎", "category": "Symbols"}, {"emoji": "♈", "category": "Symbols"}, {"emoji": "♉", "category": "Symbols"}, {"emoji": "♊", "category": "Symbols"}, {"emoji": "♋", "category": "Symbols"}, {"emoji": "♌", "category": "Symbols"}, {"emoji": "♍", "category": "Symbols"}, {"emoji": "♎", "category": "Symbols"}, {"emoji": "♏", "category": "Symbols"}, {"emoji": "♐", "category": "Symbols"}, {"emoji": "♑", "category": "Symbols"}, {"emoji": "♒", "category": "Symbols"}, {"emoji": "♓", "category": "Symbols"}, {"emoji": "🆔", "category": "Symbols"}, {"emoji": "⚛️", "category": "Symbols"}, {"emoji": "🉑", "category": "Symbols"}, {"emoji": "☢️", "category": "Symbols"}, {"emoji": "☣️", "category": "Symbols"}, {"emoji": "📴", "category": "Symbols"}, {"emoji": "📳", "category": "Symbols"}, {"emoji": "🈶", "category": "Symbols"}, {"emoji": "🈚", "category": "Symbols"}, {"emoji": "🈸", "category": "Symbols"}, {"emoji": "🈺", "category": "Symbols"}, {"emoji": "🈷️", "category": "Symbols"}, {"emoji": "✴️", "category": "Symbols"}, {"emoji": "🆚", "category": "Symbols"}, {"emoji": "💮", "category": "Symbols"}, {"emoji": "🉐", "category": "Symbols"}, {"emoji": "㊙️", "category": "Symbols"}, {"emoji": "㊗️", "category": "Symbols"}, {"emoji": "🈴", "category": "Symbols"}, {"emoji": "🈵", "category": "Symbols"}, {"emoji": "🈹", "category": "Symbols"}, {"emoji": "🈲", "category": "Symbols"}, {"emoji": "🅰️", "category": "Symbols"}, {"emoji": "🅱️", "category": "Symbols"}, {"emoji": "🆎", "category": "Symbols"}, {"emoji": "🆑", "category": "Symbols"}, {"emoji": "🅾️", "category": "Symbols"}, {"emoji": "🆘", "category": "Symbols"}, {"emoji": "❌", "category": "Symbols"}, {"emoji": "⭕", "category": "Symbols"}, {"emoji": "🛑", "category": "Symbols"}, {"emoji": "⛔", "category": "Symbols"}, {"emoji": "📛", "category": "Symbols"}, {"emoji": "🚫", "category": "Symbols"}, {"emoji": "💯", "category": "Symbols"}, {"emoji": "💢", "category": "Symbols"}, {"emoji": "♨️", "category": "Symbols"}, {"emoji": "🚷", "category": "Symbols"}, {"emoji": "🚯", "category": "Symbols"}, {"emoji": "🚳", "category": "Symbols"}, {"emoji": "🚱", "category": "Symbols"}, {"emoji": "🔞", "category": "Symbols"}, {"emoji": "📵", "category": "Symbols"}, {"emoji": "🚭", "category": "Symbols"}, {"emoji": "❗", "category": "Symbols"}, {"emoji": "❕", "category": "Symbols"}, {"emoji": "❓", "category": "Symbols"}, {"emoji": "❔", "category": "Symbols"}, {"emoji": "‼️", "category": "Symbols"}, {"emoji": "⁉️", "category": "Symbols"}, {"emoji": "🔅", "category": "Symbols"}, {"emoji": "🔆", "category": "Symbols"}, {"emoji": "〽️", "category": "Symbols"}, {"emoji": "⚠️", "category": "Symbols"}, {"emoji": "🚸", "category": "Symbols"}, {"emoji": "🔱", "category": "Symbols"}, {"emoji": "⚜️", "category": "Symbols"}, {"emoji": "🔰", "category": "Symbols"}, {"emoji": "♻️", "category": "Symbols"}, {"emoji": "✅", "category": "Symbols"}, {"emoji": "🈯", "category": "Symbols"}, {"emoji": "💹", "category": "Symbols"}, {"emoji": "❇️", "category": "Symbols"}, {"emoji": "✳️", "category": "Symbols"}, {"emoji": "❎", "category": "Symbols"}, {"emoji": "🌐", "category": "Symbols"}, {"emoji": "💠", "category": "Symbols"}, {"emoji": "Ⓜ️", "category": "Symbols"}, {"emoji": "🌀", "category": "Symbols"}, {"emoji": "💤", "category": "Symbols"}, {"emoji": "🏧", "category": "Symbols"}, {"emoji": "🚾", "category": "Symbols"}, {"emoji": "♿", "category": "Symbols"}, {"emoji": "🅿️", "category": "Symbols"}, {"emoji": "🛗", "category": "Symbols"}, {"emoji": "🚹", "category": "Symbols"}, {"emoji": "🚺", "category": "Symbols"}, {"emoji": "🚼", "category": "Symbols"}, {"emoji": "🚻", "category": "Symbols"}, {"emoji": "🚮", "category": "Symbols"}, {"emoji": "🎦", "category": "Symbols"}, {"emoji": "📶", "category": "Symbols"}];
const BOZO_BLOCKED_EMOJI = new Set(['🖕','🤬']);
let selectedEmojiFlair = '';

function looksLikeSingleEmoji(value='') {
  const text = String(value || '').trim();
  if (!text || text.length > 8) return false;
  // Reject ordinary letters/digits; allow emoji sequences, VS selectors and ZWJ.
  return !/[A-Za-z0-9]/.test(text);
}

function paintEmojiFlairPicker(query='') {
  const grid = $('emoji-flair-grid');
  if (!grid) return;
  const q = String(query || '').trim().toLowerCase();
  const rows = BOZO_EMOJI_FLAIRS.filter(item =>
    !BOZO_BLOCKED_EMOJI.has(item.emoji) &&
    (!q || item.category.toLowerCase().includes(q) || item.emoji.includes(q))
  ).slice(0, 500);
  grid.innerHTML = rows.map(item => `<button type="button" class="emoji-flair-option ${selectedEmojiFlair===item.emoji?'selected':''}" data-emoji-flair="${item.emoji}" title="${escapeHtml(item.category)}">${item.emoji}</button>`).join('');
  grid.querySelectorAll('[data-emoji-flair]').forEach(b => b.addEventListener('click', () => {
    selectedEmojiFlair = b.dataset.emojiFlair;
    $('emoji-flair-custom').value = selectedEmojiFlair;
    paintEmojiFlairPicker($('emoji-flair-search').value);
  }));
}

$('profile-flair-input')?.addEventListener('change', () => {
  const isEmoji = $('profile-flair-input').value === 'emoji';
  $('emoji-flair-picker').hidden = !isEmoji;
  if (isEmoji) paintEmojiFlairPicker();
});
$('emoji-flair-search')?.addEventListener('input', () => paintEmojiFlairPicker($('emoji-flair-search').value));
$('emoji-flair-custom')?.addEventListener('input', () => {
  const value = $('emoji-flair-custom').value.trim();
  selectedEmojiFlair = value;
});
function readableError(error) {
  if (!error) return 'Something went wrong.';
  return error.message || error.error_description || error.msg || String(error);
}

function roleLabel(role) {
  return {
    owner: 'Creator',
    administrator: 'Administrator',
    senior_moderator: 'Administrator',
    moderator: 'Moderator',
    reviewer: 'Reviewer',
    member: 'Member'
  }[role] || role;
}

function route(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  $$('[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === name));
  $('mobile-nav').hidden = true;
  history.replaceState(null, '', `#${name}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'library') searchOpenings('');
  if (name === 'endgames') loadEndgames();
  if (name === 'train') { prepareTrainPage(); setTimeout(bindScholarControls,0); }
  if (name === 'daily') loadDailyPuzzle();
  if (name === 'dashboard') renderDashboard();
  if (name === 'play') renderPlay();
  if (name === 'challenges') renderChallenges();
  if (name === 'masters') loadMasterGames();
  if (name === 'explorer') initializeMasterExplorer();
  if (name === 'friends') renderFriends();
  if (name === 'review') prepareReviewPage();
  if (name === 'studies') renderStudies();
  if (name === 'profile') renderProfile();
  if (name === 'contact') prepareContactPage();
  if (name === 'bozoplus') renderBozoPlusPage();
  if (name === 'owner') renderOwnerGate();
}

$$('[data-route]').forEach(el => el.addEventListener('click', () => route(el.dataset.route)));
$('mobile-menu-button').addEventListener('click', () => $('mobile-nav').hidden = !$('mobile-nav').hidden);


function renderBozoPlusPage() {
  const status = $('bozo-plus-page-status');
  if (!status) return;

  if (!state.session) {
    status.classList.remove('active');
    status.innerHTML = '<b>Sign in to check BOZO+ status.</b><span>Your supporter cosmetics are tied to your BOZO account.</span>';
    $('bozo-paypal-owner-card') && ($('bozo-paypal-owner-card').hidden = true);
    resetBozoPayPalCheckout('Sign in to subscribe with PayPal.');
    return;
  }

  const supporter = isBozoSupporter();
  status.classList.toggle('active', supporter);
  status.innerHTML = supporter
    ? `<b>BOZO+ ACTIVE</b><span>${state.profile?.supporter_since ? `Supporter since ${new Date(state.profile.supporter_since).toLocaleDateString(undefined,{month:'long',year:'numeric'})}.` : 'Supporter cosmetics are unlocked on this account.'}</span>`
    : '<b>BOZO+ NOT ACTIVE</b><span>Your account does not currently have the supporter entitlement.</span>';

  if ($('bozo-paypal-owner-card')) $('bozo-paypal-owner-card').hidden = state.role !== 'owner';
  setTimeout(loadBozoPlusCheckout, 0);
  setTimeout(loadBozoPlusManage, 0);
}

$('bozo-plus-open-settings')?.addEventListener('click', () => {
  if (!state.session) return openAuth('signin');
  route('profile');
  setTimeout(() => {
    document.querySelector('[data-profile-tab="settings"]')?.click();
    $('bozo-plus-customizer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
});

function openAuth(tab = 'signin') {
  $('auth-modal').hidden = false;
  setAuthTab(tab);
}
function closeAuth() {
  hideAuthVerificationStates(); $('auth-modal').hidden = true; }
$('close-auth-modal').addEventListener('click', closeAuth);
$('auth-modal').addEventListener('click', e => { if (e.target.id === 'auth-modal') closeAuth(); });
$$('.open-auth').forEach(b => b.addEventListener('click', () => openAuth()));
const accountMenu = $('account-menu');
const accountPopover = $('account-menu-popover');
function setAccountMenuOpen(open) {
  if (!accountPopover) return;
  accountPopover.hidden = !open;
  $('header-auth-button')?.setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('header-auth-button').addEventListener('click', e => {
  e.stopPropagation();
  if (!state.session) return openAuth();
  setAccountMenuOpen(accountPopover?.hidden ?? true);
});
$('account-profile-button')?.addEventListener('click', () => { setAccountMenuOpen(false); route('profile'); });
$('account-owner-button')?.addEventListener('click', () => { setAccountMenuOpen(false); route('owner'); });
$('account-signout-button')?.addEventListener('click', async () => {
  setAccountMenuOpen(false);
  await sb.auth.signOut();
  route('home');
  toast('Signed out');
});
document.addEventListener('click', e => {
  if (accountMenu && !accountMenu.contains(e.target)) setAccountMenuOpen(false);
});
$('hero-start-button').addEventListener('click', () => state.session ? route('dashboard') : openAuth('signup'));

let pendingVerificationEmail = '';

function authVerificationRedirectUrl() {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('verified', '1');
  return url.toString();
}

function hideAuthVerificationStates() {
  if ($('auth-check-email')) $('auth-check-email').hidden = true;
  if ($('auth-verified')) $('auth-verified').hidden = true;
  if ($('auth-reset-sent')) $('auth-reset-sent').hidden = true;
  if ($('auth-new-password')) $('auth-new-password').hidden = true;
}

function showCheckEmailState(email) {
  pendingVerificationEmail = String(email || '').trim();
  $('auth-signin-tab').classList.remove('active');
  $('auth-signup-tab').classList.remove('active');
  $('signin-form').hidden = true;
  $('signup-form').hidden = true;
  $('auth-message').textContent = '';
  $('auth-message').classList.remove('error');
  $('auth-check-email').hidden = false;
  $('auth-verified').hidden = true;
  $('auth-verification-email').textContent = pendingVerificationEmail || 'your email';
  $('auth-verification-message').textContent = '';
  $('auth-verification-message').classList.remove('error');
}

function showVerifiedState() {
  $('auth-modal').hidden = false;
  $('auth-signin-tab').classList.remove('active');
  $('auth-signup-tab').classList.remove('active');
  $('signin-form').hidden = true;
  $('signup-form').hidden = true;
  $('auth-check-email').hidden = true;
  $('auth-verified').hidden = false;
  $('auth-message').textContent = '';
  $('auth-message').classList.remove('error');
}

function setAuthTab(tab) {
  hideAuthVerificationStates();
  const signin = tab === 'signin';
  $('auth-signin-tab').classList.toggle('active', signin);
  $('auth-signup-tab').classList.toggle('active', !signin);
  $('signin-form').hidden = !signin;
  $('signup-form').hidden = signin;
  setAuthMessage('');
}
$('auth-signin-tab').addEventListener('click', () => setAuthTab('signin'));
$('auth-signup-tab').addEventListener('click', () => setAuthTab('signup'));

function setAuthMessage(message, error = false) {
  const el = $('auth-message');
  el.textContent = message;
  el.classList.toggle('error', error);
}

$('signin-form').addEventListener('submit', async e => {
  e.preventDefault();
  setAuthMessage('Signing in…');
  const { error } = await sb.auth.signInWithPassword({
    email: $('signin-email').value.trim(),
    password: $('signin-password').value
  });
  if (error) return setAuthMessage(readableError(error), true);
  closeAuth();
  toast('Signed in');
  route('dashboard');
});

$('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  const ign = $('signup-ign').value.trim();
  const username = $('signup-username').value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');

  if (username.length < 3) return setAuthMessage('Username must be at least 3 characters.', true);

  const ignModeration = validateBozoName(ign, 'IGN');
  if (ignModeration) return setAuthMessage(ignModeration, true);

  const usernameModeration = validateBozoName(username, 'Username');
  if (usernameModeration) return setAuthMessage(usernameModeration, true);

  const email = $('signup-email').value.trim();
  setAuthMessage('Creating account…');

  const { data, error } = await sb.auth.signUp({
    email,
    password: $('signup-password').value,
    options: {
      emailRedirectTo: authVerificationRedirectUrl(),
      data: { ign, username }
    }
  });
$('auth-resend-verification')?.addEventListener('click', async () => {
  const email = pendingVerificationEmail || $('signin-email').value.trim();
  const message = $('auth-verification-message');

  if (!email) {
    message.textContent = 'Enter your email again from the Create account tab.';
    message.classList.add('error');
    return;
  }

  const button = $('auth-resend-verification');
  button.disabled = true;
  button.textContent = 'Sending…';
  message.textContent = '';

  try {
    const { error } = await sb.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authVerificationRedirectUrl() }
    });
    if (error) throw error;
    message.textContent = 'Verification email sent again.';
    message.classList.remove('error');
  } catch (error) {
    message.textContent = readableError(error);
    message.classList.add('error');
  } finally {
    button.disabled = false;
    button.textContent = 'Resend verification email';
  }
});

$('auth-back-to-signin')?.addEventListener('click', () => {
  setAuthTab('signin');
  if (pendingVerificationEmail) $('signin-email').value = pendingVerificationEmail;
});

$('auth-verified-continue')?.addEventListener('click', async () => {
  const button = $('auth-verified-continue');
  if (button?.disabled) return;

  if (button) {
    button.disabled = true;
    button.textContent = 'Continuing…';
  }

  try {
    // Refresh session state in case Supabase established one during confirmation.
    const { data } = await sb.auth.getSession();
    state.session = data?.session || null;

    hideAuthVerificationStates();

    if (state.session) {
      closeAuth();
      await loadIdentity();
      route('dashboard');
      return;
    }

    // Email confirmation usually verifies the account without signing the user in.
    // Keep the modal open and switch directly to a clean Sign In state.
    $('auth-modal').hidden = false;
    setAuthTab('signin');
    if (pendingVerificationEmail) $('signin-email').value = pendingVerificationEmail;
    $('signin-password')?.focus();
  } catch (error) {
    console.error('Verification continue failed:', error);
    hideAuthVerificationStates();
    setAuthTab('signin');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Continue to BOZO';
    }
  }
});



  if (error) return setAuthMessage(readableError(error), true);

  $('signin-email').value = email;

  if (!data.session) {
    showCheckEmailState(email);
  } else {
    closeAuth();
    route('dashboard');
  }
});

function passwordRecoveryRedirectUrl() {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('recovery', '1');
  return url.toString();
}

function showResetEmailSent(email) {
  hideAuthVerificationStates();
  $('auth-modal').hidden = false;
  $('auth-signin-tab').classList.remove('active');
  $('auth-signup-tab').classList.remove('active');
  $('signin-form').hidden = true;
  $('signup-form').hidden = true;
  $('auth-reset-email').textContent = email || 'your email';
  $('auth-reset-sent').hidden = false;
  setAuthMessage('');
}

function showNewPasswordState() {
  hideAuthVerificationStates();
  $('auth-modal').hidden = false;
  $('auth-signin-tab').classList.remove('active');
  $('auth-signup-tab').classList.remove('active');
  $('signin-form').hidden = true;
  $('signup-form').hidden = true;
  $('auth-new-password').hidden = false;
  $('auth-reset-message').textContent = '';
  $('auth-new-password-input').value = '';
  $('auth-new-password-confirm').value = '';
  setTimeout(() => $('auth-new-password-input')?.focus(), 30);
}

$('forgot-password-button').addEventListener('click', async () => {
  const email = $('signin-email').value.trim();
  if (!email) return setAuthMessage('Enter your email first.', true);

  setAuthMessage('Sending password-reset email…');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: passwordRecoveryRedirectUrl() });
  if (error) return setAuthMessage(readableError(error), true);

  showResetEmailSent(email);
});

$('auth-reset-back')?.addEventListener('click', () => setAuthTab('signin'));

$('auth-new-password-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = $('auth-new-password-input').value;
  const confirmPassword = $('auth-new-password-confirm').value;
  const message = $('auth-reset-message');

  if (password.length < 8) {
    message.textContent = 'Use at least 8 characters.';
    message.classList.add('error');
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = 'The passwords do not match.';
    message.classList.add('error');
    return;
  }

  message.textContent = 'Saving your new password…';
  message.classList.remove('error');

  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    message.textContent = readableError(error);
    message.classList.add('error');
    return;
  }

  message.textContent = 'Password changed. You can use it the next time you sign in.';
  message.classList.remove('error');
  const clean = new URL(window.location.href);
  clean.searchParams.delete('recovery');
  history.replaceState({}, '', clean.pathname + clean.search + clean.hash);
  setTimeout(async () => {
    closeAuth();
    await loadIdentity();
    route('dashboard');
    toast('Password updated');
  }, 800);
});

async function loadIdentity() {
  if (!state.session?.user) {
    state.profile = null; state.role = 'member'; state.progress = null;
    await window.BozoMastery?.setAuth?.(sb, null);
    renderShell(); return;
  }

  const uid = state.session.user.id;
  const [profileRes, roleRes, progressRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('user_roles').select('role').eq('user_id', uid).maybeSingle(),
    sb.from('user_progress').select('*').eq('user_id', uid).maybeSingle()
  ]);

  if (profileRes.error) console.warn(profileRes.error);
  if (roleRes.error) console.warn(roleRes.error);
  if (progressRes.error) console.warn(progressRes.error);

  state.profile = profileRes.data;
  state.role = roleRes.data?.role || 'member';
  state.progress = progressRes.data;
  await window.BozoMastery?.setAuth?.(sb, state.session.user);
  renderShell();
  await loadAnnouncement();
}

function renderShell() {
  const signedIn = Boolean(state.session?.user);
  if ($('cloud-state')) $('cloud-state').textContent = signedIn ? '● cloud connected' : '● cloud ready';
  $('header-auth-button').textContent = signedIn ? (state.profile?.ign || 'Profile') : 'Sign in';
  const isOwner = state.role === 'owner';
  if ($('account-menu')) $('account-menu').hidden = false;
  if ($('account-profile-button')) $('account-profile-button').hidden = !signedIn;
  if ($('account-signout-button')) $('account-signout-button').hidden = !signedIn;
  if ($('account-owner-button')) $('account-owner-button').hidden = !(signedIn && isOwner);
  if ($('owner-mobile-nav')) $('owner-mobile-nav').hidden = !isOwner;
  if ($('dashboard-owner-shortcut')) $('dashboard-owner-shortcut').hidden = !isOwner;
  document.querySelector('.site-header')?.classList.toggle('owner-shell', isOwner);

  const mastery = masteryStats();
  $('home-mastery-preview').textContent = mastery.total.toLocaleString();

  renderDashboard();
  renderProfile();
  renderChallenges();
  renderFriends();
}

function masteryStats() {
  const openingMastery = state.progress?.settings?.openingMastery || {};
  const records = Object.values(openingMastery);
  return {
    records,
    mastered: records.filter(r => r.masteryAwarded).length,
    total: records.reduce((sum, r) => sum + Number(r.masteryPoints || (r.masteryAwarded ? 500 : 0)), 0)
  };
}


function activityLabel(item = {}) {
  const payload = item.payload || {};
  const labels = {
    opening_studied: ['♟️', `Studied ${payload.opening || 'an opening'}`],
    game_reviewed: ['🔎', `Reviewed ${payload.opening || 'a game'}`],
    profile_updated: ['👤', 'Updated profile'],
    friend_added: ['👥', `Became friends with ${payload.username ? '@' + payload.username : 'a player'}`],
    suggestion_submitted: ['💡', `Suggested an improvement${payload.opening ? ` to ${payload.opening}` : ''}`],
    challenge_completed: ['⚔️', `Completed a challenge${payload.opening ? ` in ${payload.opening}` : ''}`]
  };
  return labels[item.activity_type] || ['•', String(item.activity_type || 'BOZO activity').replaceAll('_', ' ')];
}

function relativeActivityTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function activityMarkup(rows = [], emptyCopy = 'No activity yet. Start studying to build your timeline.') {
  if (!rows.length) return `<div class="empty-state mini"><b>Nothing here yet</b><span>${escapeHtml(emptyCopy)}</span></div>`;
  return rows.map(item => {
    const [icon, label] = activityLabel(item);
    return `<article class="activity-row"><span class="activity-icon">${icon}</span><div><b>${escapeHtml(label)}</b><small>${escapeHtml(relativeActivityTime(item.created_at))}</small></div></article>`;
  }).join('');
}

async function logActivity(activityType, payload = {}) {
  if (!state.session?.user) return;
  const { error } = await sb.from('user_activity').insert({
    user_id: state.session.user.id,
    activity_type: activityType,
    payload
  });
  if (error && !/relation .* does not exist|permission denied/i.test(error.message || '')) console.warn('Activity log failed:', error);
}

async function loadDashboardConnectedData() {
  if (!state.session?.user) return;
  const uid = state.session.user.id;
  const [{ data: activity, error: activityError }, { data: studies, error: studiesError }] = await Promise.all([
    sb.from('user_activity').select('activity_type,payload,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(8),
    sb.from('user_activity').select('activity_type,payload,created_at').eq('user_id', uid).eq('activity_type', 'opening_studied').order('created_at', { ascending: false }).limit(1)
  ]);

  const feed = $('dashboard-activity-feed');
  if (feed) feed.innerHTML = activityError
    ? `<div class="empty-state mini"><b>Activity setup needed</b><span>Run the BOZO 2.7 Supabase migration.</span></div>`
    : activityMarkup(activity || []);

  const latestStudy = !studiesError && studies?.[0];
  const focus = $('dashboard-focus-card');
  if (focus) {
    if (latestStudy?.payload?.opening_id) {
      focus.innerHTML = `<span class="eyebrow">CONTINUE STUDYING</span><h3>${escapeHtml(latestStudy.payload.opening || 'Opening')}</h3><p>Pick up where your recent study session left off.</p><button class="button primary" data-focus-opening="${escapeHtml(String(latestStudy.payload.opening_id))}">Continue</button>`;
      focus.querySelector('[data-focus-opening]')?.addEventListener('click', e => openStudyById(e.currentTarget.dataset.focusOpening));
    } else {
      focus.innerHTML = `<span class="eyebrow">BUILD YOUR REPERTOIRE</span><h3>Choose your next opening</h3><p>Browse published theory and begin a study session.</p><button class="button primary" data-route="library">Browse openings</button>`;
      focus.querySelector('[data-route]')?.addEventListener('click', () => route('library'));
    }
  }

  const mastery = masteryStats();
  const types = new Set((activity || []).map(item => item.activity_type));
  const achievements = [
    ['First Study', 'Study your first opening', types.has('opening_studied')],
    ['Game Detective', 'Complete a game review', types.has('game_reviewed')],
    ['Profile Ready', 'Customize your BOZO identity', Boolean(state.profile?.bio || state.profile?.favorite_white_opening)],
    ['Opening Specialist', 'Master your first opening', mastery.mastered > 0],
    ['On a Roll', 'Reach a 7-day streak', Number(state.progress?.current_streak || 0) >= 7],
    ['Community Voice', 'Submit an opening improvement', types.has('suggestion_submitted')]
  ];
  const achievementTarget = $('dashboard-achievements');
  if (achievementTarget) achievementTarget.innerHTML = achievements.map(([name, description, unlocked]) => `<article class="achievement-card ${unlocked ? 'unlocked' : ''}"><span>${unlocked ? '🏅' : '🔒'}</span><div><b>${escapeHtml(name)}</b><small>${escapeHtml(description)}</small></div></article>`).join('');
}

function renderDashboard() {
  const signedIn = Boolean(state.session?.user);
  $('dashboard-guest').hidden = signedIn;
  $('dashboard-user').hidden = !signedIn;
  if (!signedIn) return;

  const mastery = masteryStats();
  $('dashboard-greeting').textContent = `Welcome back, ${state.profile?.ign || 'Player'}.`;
  $('dashboard-xp').textContent = Number(state.progress?.xp || 0).toLocaleString();
  $('dashboard-mastery').textContent = mastery.total.toLocaleString();
  $('dashboard-mastered').textContent = mastery.mastered.toLocaleString();
  $('dashboard-streak').textContent = Number(state.progress?.current_streak || 0).toLocaleString();

  const room = $('web-trophy-room');
  const records = mastery.records
    .filter(r => Array.isArray(r.stars) && r.stars.some(Boolean))
    .sort((a,b) => Number(b.masteryAwarded)-Number(a.masteryAwarded) || b.stars.filter(Boolean).length-a.stars.filter(Boolean).length);

  loadDashboardConnectedData();
  setTimeout(loadDashboardGameLoop, 0);

  room.innerHTML = records.length ? records.slice(0, 12).map(r => `
    <div class="trophy-row">
      <div><b>${escapeHtml(r.name || 'Opening')}</b><small>${r.masteryAwarded ? 'Mastered · +500' : `${r.stars.filter(Boolean).length}/5 stars`}</small></div>
      <div class="trophy-stars">${r.stars.map(on => on ? '★' : '☆').join('')}</div>
    </div>
  `).join('') : `<div class="empty-state"><div>🏆</div><b>No trophies yet</b><span>Train an opening in the Android app to begin your shared Trophy Room.</span></div>`;
}

$('dashboard-sync-button').addEventListener('click', async () => {
  await loadIdentity();
  await window.BozoMastery?.syncNow?.();
  toast('Cloud data refreshed');
});



const BOZO_SUPPORTER_BADGE = './assets/bozo-supporter.png';
const BOZO_BACKGROUND_BUCKET = 'profile-backgrounds';
let pendingBackgroundFile = null;
let pendingBackgroundObjectUrl = null;

function isBozoSupporter(profile=state.profile) {
  return Boolean(profile?.is_supporter);
}

function validBozoNameColor(value) {
  const v = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#fff4ea';
}

function applyProfileCosmetics(element, profile) {
  if (!element) return;
  const supporter = Boolean(profile?.is_supporter);
  const background = supporter ? String(profile?.profile_background_url || '') : '';
  element.classList.toggle('bozo-plus-profile', supporter);
  element.style.setProperty('--bozo-name-color', supporter ? validBozoNameColor(profile?.name_color) : '#fff4ea');
  if (background) {
    element.style.backgroundImage = `linear-gradient(rgba(19,7,27,.70),rgba(19,7,27,.80)),url("${background.replace(/"/g,'%22')}")`;
    element.classList.add('has-custom-profile-background');
  } else {
    element.style.backgroundImage = '';
    element.classList.remove('has-custom-profile-background');
  }
}

async function getPublicCosmetics(username) {
  if (!username) return null;
  const { data, error } = await sb.rpc('get_public_identity', { target_username: username });
  if (error) {
    const fallback = await sb.rpc('get_public_cosmetics', { target_username: username });
    if (fallback.error) throw fallback.error;
    return Array.isArray(fallback.data) ? fallback.data[0] : fallback.data;
  }
  return Array.isArray(data) ? data[0] : data;
}

function paintBozoPlusSettings() {
  const supporter = isBozoSupporter();
  const locked = $('bozo-plus-locked');
  const controls = $('bozo-plus-controls');
  const badge = $('profile-supporter-badge');
  if (locked) locked.hidden = supporter;
  if (controls) controls.hidden = !supporter;
  if (badge) badge.hidden = !supporter;
  if ($('bozo-plus-status-copy')) {
    $('bozo-plus-status-copy').textContent = supporter
      ? `Supporter${state.profile?.supporter_since ? ` since ${new Date(state.profile.supporter_since).toLocaleDateString(undefined,{month:'short',year:'numeric'})}` : ''}.`
      : 'Support BOZO to unlock profile cosmetics.';
  }

  const color = validBozoNameColor(state.profile?.name_color || '#b784ff');
  if ($('bozo-name-color-picker')) $('bozo-name-color-picker').value = color;
  if ($('bozo-name-color-hex')) $('bozo-name-color-hex').value = color;

  const bg = supporter ? state.profile?.profile_background_url : null;
  const preview = $('bozo-background-preview');
  if (preview) {
    preview.style.backgroundImage = bg ? `url("${bg}")` : '';
    preview.innerHTML = bg ? '' : '<span>No custom background</span>';
  }
}

function backgroundPublicUrl(path) {
  return sb.storage.from(BOZO_BACKGROUND_BUCKET).getPublicUrl(path).data.publicUrl;
}

function clearPendingBackground() {
  pendingBackgroundFile = null;
  if (pendingBackgroundObjectUrl) URL.revokeObjectURL(pendingBackgroundObjectUrl);
  pendingBackgroundObjectUrl = null;
  if ($('bozo-background-input')) $('bozo-background-input').value = '';
  if ($('bozo-background-upload')) $('bozo-background-upload').disabled = true;
}

function selectBackgroundFile(file) {
  if (!isBozoSupporter()) return toast('BOZO+ is required for custom profile backgrounds.');
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
    return toast('Use a JPG, PNG, WebP, or GIF background.');
  }
  if (file.size > 10 * 1024 * 1024) return toast('Profile backgrounds must be under 10 MB.');
  clearPendingBackground();
  pendingBackgroundFile = file;
  pendingBackgroundObjectUrl = URL.createObjectURL(file);
  $('bozo-background-preview').style.backgroundImage = `url("${pendingBackgroundObjectUrl}")`;
  $('bozo-background-preview').innerHTML = '';
  $('bozo-background-upload').disabled = false;
  $('bozo-background-status').textContent = 'Ready to upload.';
}

async function uploadBozoBackground() {
  if (!isBozoSupporter() || !pendingBackgroundFile || !state.session?.user) return;
  const button = $('bozo-background-upload');
  button.disabled = true;
  button.textContent = 'Uploading…';
  try {
    const userId = state.session.user.id;
    const ext = pendingBackgroundFile.type === 'image/gif' ? 'gif'
      : pendingBackgroundFile.type === 'image/png' ? 'png'
      : pendingBackgroundFile.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/background.${ext}`;
    await sb.storage.from(BOZO_BACKGROUND_BUCKET).remove([
      `${userId}/background.gif`,`${userId}/background.png`,`${userId}/background.webp`,`${userId}/background.jpg`
    ]);
    const { error: uploadError } = await sb.storage.from(BOZO_BACKGROUND_BUCKET).upload(
      path, pendingBackgroundFile,
      { contentType: pendingBackgroundFile.type, cacheControl:'3600', upsert:true }
    );
    if (uploadError) throw uploadError;
    const url = `${backgroundPublicUrl(path)}?v=${Date.now()}`;
    const { error } = await sb.from('profiles').update({ profile_background_url:url }).eq('id',userId);
    if (error) throw error;
    clearPendingBackground();
    await loadIdentity();
    paintBozoPlusSettings();
    renderProfile();
    toast('BOZO+ background updated');
  } catch (error) {
    $('bozo-background-status').textContent = readableError(error);
  } finally {
    button.textContent = 'Upload background';
    button.disabled = !pendingBackgroundFile;
  }
}

async function removeBozoBackground() {
  if (!isBozoSupporter() || !state.session?.user) return;
  const userId=state.session.user.id;
  const { error } = await sb.from('profiles').update({profile_background_url:null}).eq('id',userId);
  if (error) return toast(readableError(error));
  await sb.storage.from(BOZO_BACKGROUND_BUCKET).remove([
    `${userId}/background.gif`,`${userId}/background.png`,`${userId}/background.webp`,`${userId}/background.jpg`
  ]);
  await loadIdentity();
  paintBozoPlusSettings();
  renderProfile();
  toast('Profile background removed');
}

async function saveBozoPlusColor() {
  if (!isBozoSupporter() || !state.session?.user) return;
  const color = validBozoNameColor($('bozo-name-color-hex')?.value || $('bozo-name-color-picker')?.value);
  const { error } = await sb.from('profiles').update({name_color:color}).eq('id',state.session.user.id);
  if (error) return toast(readableError(error));
  await loadIdentity();
  renderProfile();
  toast('BOZO+ name color saved');
}

let ratedOpponentSupporterCache = { username: null, profile: null, pending: false, token: 0 };

async function paintRatedSupporterBadges() {
  if (!ratedMatchSession) return;
  const mine = $('rated-my-supporter-badge');
  const opp = $('rated-opponent-supporter-badge');
  if (mine) mine.hidden = !isBozoSupporter();
  const myIdentity = $('rated-my-identity-badges');
  if (myIdentity) myIdentity.innerHTML = compactIdentityBadges(state.profile || {}, state.role || '');

  const opponentUsername = String(ratedMatchSession.opponent_username || '').trim();
  const oppLabel = $('bot-strength-label');
  const myLabel = $('bot-player-color-label');

  if (myLabel) {
    myLabel.style.color = isBozoSupporter()
      ? validBozoNameColor(state.profile?.name_color)
      : '';
  }

  if (ratedOpponentSupporterCache.username === opponentUsername && ratedOpponentSupporterCache.profile) {
    const cached = ratedOpponentSupporterCache.profile;
    if (opp) opp.hidden = !cached.is_supporter;
    if ($('rated-opponent-identity-badges')) $('rated-opponent-identity-badges').innerHTML = compactIdentityBadges(cached, cached.role || '');
    if (oppLabel) oppLabel.style.color = cached.is_supporter ? validBozoNameColor(cached.name_color) : '';
    return;
  }

  if (!opponentUsername) {
    if (opp) opp.hidden = true;
    if ($('rated-opponent-identity-badges')) $('rated-opponent-identity-badges').innerHTML = '';
    if (oppLabel) oppLabel.style.color = '';
    return;
  }

  if (ratedOpponentSupporterCache.pending && ratedOpponentSupporterCache.username === opponentUsername) return;

  const token = ++ratedOpponentSupporterCache.token;
  ratedOpponentSupporterCache.username = opponentUsername;
  ratedOpponentSupporterCache.pending = true;

  try {
    const opponent = await getPublicCosmetics(opponentUsername);
    if (!ratedMatchSession || token !== ratedOpponentSupporterCache.token) return;
    if (String(ratedMatchSession.opponent_username || '').trim() !== opponentUsername) return;

    ratedOpponentSupporterCache.profile = opponent || { is_supporter: false, name_color: null };
    if (opp) opp.hidden = !ratedOpponentSupporterCache.profile.is_supporter;
    if ($('rated-opponent-identity-badges')) $('rated-opponent-identity-badges').innerHTML = compactIdentityBadges(ratedOpponentSupporterCache.profile, ratedOpponentSupporterCache.profile.role || '');
    if (oppLabel) {
      oppLabel.style.color = ratedOpponentSupporterCache.profile.is_supporter
        ? validBozoNameColor(ratedOpponentSupporterCache.profile.name_color)
        : '';
    }
  } catch (_) {
    if (!ratedOpponentSupporterCache.profile && opp) opp.hidden = true;
  } finally {
    if (token === ratedOpponentSupporterCache.token) ratedOpponentSupporterCache.pending = false;
  }
}

const PROFILE_AVATAR_BUCKET = 'avatars';
const PROFILE_AVATAR_FALLBACK = './assets/bozo-mascot.webp';
let repertoireOpeningNames = [];
let repertoireOptionsLoaded = false;
let repertoireOptionsPromise = null;
let repertoireOptionsError = '';

function openingPickerForInput(inputId) {
  return document.querySelector(`.opening-picker[data-opening-picker="${inputId}"]`);
}

function setOpeningPickerValue(inputId, value = '') {
  const input = $(inputId);
  const picker = openingPickerForInput(inputId);
  if (!input || !picker) return;
  const normalized = value || '';
  input.value = normalized;
  const label = picker.querySelector('.opening-picker-value');
  if (label) label.textContent = normalized || 'Not selected';
}

function closeOpeningPicker(picker) {
  if (!picker) return;
  const menu = picker.querySelector('.opening-picker-menu');
  const trigger = picker.querySelector('.opening-picker-trigger');
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  picker.classList.remove('open');
}

function closeAllOpeningPickers(except = null) {
  document.querySelectorAll('.opening-picker.open').forEach(picker => {
    if (picker !== except) closeOpeningPicker(picker);
  });
}

function renderOpeningPickerResults(picker, query = '') {
  const results = picker?.querySelector('.opening-picker-results');
  if (!results) return;

  if (!repertoireOptionsLoaded && !repertoireOptionsError) {
    results.innerHTML = '<div class="opening-picker-empty">Loading published openings…</div>';
    return;
  }

  if (repertoireOptionsError && !repertoireOpeningNames.length) {
    results.innerHTML = `<div class="opening-picker-empty">Could not load openings.<br><button type="button" class="opening-picker-retry">Try again</button></div>`;
    return;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const matches = repertoireOpeningNames
    .filter(name => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
    .slice(0, 150);

  if (!matches.length && normalizedQuery) {
    results.innerHTML = '<div class="opening-picker-empty">No matching openings found.</div>';
    return;
  }

  const choices = [''].concat(matches);
  results.innerHTML = choices.map(name => {
    const label = name || 'Not selected';
    return `<button type="button" class="opening-picker-option" role="option" data-opening-value="${escapeHtml(name)}">${escapeHtml(label)}</button>`;
  }).join('');
}

function initializeOpeningPickers() {
  document.querySelectorAll('.opening-picker').forEach(picker => {
    if (picker.dataset.ready === 'true') return;
    picker.dataset.ready = 'true';
    const inputId = picker.dataset.openingPicker;
    const trigger = picker.querySelector('.opening-picker-trigger');
    const menu = picker.querySelector('.opening-picker-menu');
    const search = picker.querySelector('.opening-picker-search');
    const results = picker.querySelector('.opening-picker-results');

    trigger?.addEventListener('click', async () => {
      const willOpen = menu.hidden;
      closeAllOpeningPickers(picker);
      menu.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
      picker.classList.toggle('open', willOpen);
      if (willOpen) {
        search.value = '';
        renderOpeningPickerResults(picker);
        requestAnimationFrame(() => search.focus());
        if (!repertoireOptionsLoaded) {
          await loadRepertoireOpeningOptions();
          if (picker.classList.contains('open')) renderOpeningPickerResults(picker, search.value);
        }
      }
    });

    search?.addEventListener('input', () => renderOpeningPickerResults(picker, search.value));
    search?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeOpeningPicker(picker);
        trigger?.focus();
      }
    });

    results?.addEventListener('click', async event => {
      const retry = event.target.closest('.opening-picker-retry');
      if (retry) {
        repertoireOptionsLoaded = false;
        repertoireOptionsError = '';
        renderOpeningPickerResults(picker, search.value);
        await loadRepertoireOpeningOptions(true);
        renderOpeningPickerResults(picker, search.value);
        return;
      }
      const option = event.target.closest('.opening-picker-option');
      if (!option) return;
      setOpeningPickerValue(inputId, option.dataset.openingValue || '');
      closeOpeningPicker(picker);
      trigger?.focus();
    });
  });
}

document.addEventListener('click', event => {
  if (!event.target.closest('.opening-picker')) closeAllOpeningPickers();
});

async function loadRepertoireOpeningOptions(force = false) {
  initializeOpeningPickers();
  if (repertoireOptionsLoaded && !force) return repertoireOpeningNames;
  if (repertoireOptionsPromise && !force) return repertoireOptionsPromise;

  const pickers = [...document.querySelectorAll('.opening-picker')];
  pickers.forEach(picker => {
    picker.classList.add('loading');
    renderOpeningPickerResults(picker);
  });
  repertoireOptionsError = '';

  repertoireOptionsPromise = (async () => {
    // Use the same published-opening shape as the public Opening Library.
    // Fetch in pages so projects with more than Supabase's row cap still work.
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; from < 10000; from += pageSize) {
      const { data, error } = await sb.from('openings')
        .select('id,name,status')
        .eq('status', 'published')
        .order('name', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    repertoireOpeningNames = [...new Set(rows
      .map(row => familyBaseName(String(row.name || '').trim()))
      .filter(name => name && name !== 'Unnamed Opening'))]
      .sort((a, b) => a.localeCompare(b));

    repertoireOptionsLoaded = true;
    return repertoireOpeningNames;
  })().catch(error => {
    repertoireOptionsError = readableError(error);
    repertoireOptionsLoaded = false;
    console.warn('Could not load repertoire opening choices:', error);
    return [];
  }).finally(() => {
    repertoireOptionsPromise = null;
    pickers.forEach(picker => {
      picker.classList.remove('loading');
      renderOpeningPickerResults(picker, picker.querySelector('.opening-picker-search')?.value || '');
    });
  });

  return repertoireOptionsPromise;
}

let pendingAvatarBlob = null;
let pendingAvatarObjectUrl = null;

function setAvatarStatus(message, isError = false) {
  const element = $('profile-avatar-status');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function clearPendingAvatar() {
  pendingAvatarBlob = null;
  if (pendingAvatarObjectUrl) URL.revokeObjectURL(pendingAvatarObjectUrl);
  pendingAvatarObjectUrl = null;
  if ($('profile-avatar-input')) $('profile-avatar-input').value = '';
  if ($('profile-avatar-upload')) $('profile-avatar-upload').disabled = true;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened.'));
    };
    image.src = url;
  });
}

async function createSquareAvatar(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Use a JPG, PNG, WebP, or GIF image.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Profile pictures must be smaller than 8 MB.');
  }

  const image = await loadImageFile(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - side) / 2);
  const sourceY = Math.floor((image.naturalHeight - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The image could not be prepared.')),
      'image/webp',
      0.88
    );
  });
}

function avatarPublicUrl(path) {
  return sb.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function selectAvatarFile(file) {
  try {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))
      throw new Error('Use a JPG, PNG, WebP, or GIF image.');
    if (file.size > 8 * 1024 * 1024)
      throw new Error('Profile pictures must be smaller than 8 MB.');

    const preserveAnimation = isBozoSupporter() && ['image/gif','image/webp'].includes(file.type);
    setAvatarStatus(preserveAnimation ? 'Preparing animated BOZO+ avatar…' : 'Preparing image…');
    pendingAvatarBlob = preserveAnimation ? file : await createSquareAvatar(file);

    if (pendingAvatarObjectUrl) URL.revokeObjectURL(pendingAvatarObjectUrl);
    pendingAvatarObjectUrl = URL.createObjectURL(pendingAvatarBlob);
    $('profile-avatar-preview').src = pendingAvatarObjectUrl;
    $('profile-avatar-upload').disabled = false;
    pendingAvatarBlob._bozoOriginalType = preserveAnimation ? file.type : 'image/webp';
    setAvatarStatus(preserveAnimation
      ? 'Ready to upload. Animation will be preserved.'
      : 'Ready to upload. Your image will appear as a square.');
  } catch (error) {
    clearPendingAvatar();
    setAvatarStatus(error.message || 'Could not prepare that image.', true);
  }
}
async function uploadProfileAvatar() {
  if (!state.session?.user || !pendingAvatarBlob) return;
  const button = $('profile-avatar-upload');
  button.disabled = true;
  button.textContent = 'Uploading…';
  setAvatarStatus('Uploading securely to your BOZO account…');

  try {
    const userId = state.session.user.id;
    const originalType = pendingAvatarBlob._bozoOriginalType || pendingAvatarBlob.type || 'image/webp';
    const ext = originalType === 'image/gif' ? 'gif' : 'webp';
    const path = `${userId}/avatar.${ext}`;
    await sb.storage.from(PROFILE_AVATAR_BUCKET).remove([
      `${userId}/avatar.webp`, `${userId}/avatar.gif`
    ]);
    const { error: uploadError } = await sb.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(path, pendingAvatarBlob, {
        contentType: originalType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const publicUrl = `${avatarPublicUrl(path)}?v=${Date.now()}`;
    const { error: profileError } = await sb
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (profileError) throw profileError;

    clearPendingAvatar();
    await loadIdentity();
    setAvatarStatus('Profile picture updated.');
    toast('Profile picture updated');
  } catch (error) {
    console.error('Profile picture upload failed:', error);
    button.disabled = false;
    setAvatarStatus(readableError(error), true);
  } finally {
    button.textContent = 'Upload picture';
  }
}

async function removeProfileAvatar() {
  if (!state.session?.user) return;
  if (!confirm('Replace your profile picture with the BOZO mascot?')) return;

  const userId = state.session.user.id;
  setAvatarStatus('Removing profile picture…');

  const { error: profileError } = await sb
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);

  if (profileError) {
    setAvatarStatus(readableError(profileError), true);
    return;
  }

  const { error: storageError } = await sb.storage
    .from(PROFILE_AVATAR_BUCKET)
    .remove([`${userId}/avatar.webp`, `${userId}/avatar.gif`]);

  if (storageError) console.warn('Old avatar file could not be removed:', storageError);

  clearPendingAvatar();
  await loadIdentity();
  setAvatarStatus('Using the BOZO mascot.');
  toast('Profile picture removed');
}

$('profile-avatar-edit')?.addEventListener('click', () => $('profile-avatar-input')?.click());
$('profile-avatar-choose')?.addEventListener('click', () => $('profile-avatar-input')?.click());
$('profile-avatar-input')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) selectAvatarFile(file);
});
$('profile-avatar-upload')?.addEventListener('click', uploadProfileAvatar);
$('profile-avatar-remove')?.addEventListener('click', removeProfileAvatar);
$('bozo-background-choose')?.addEventListener('click', () => $('bozo-background-input')?.click());
$('bozo-background-input')?.addEventListener('change', event => selectBackgroundFile(event.target.files?.[0]));
$('bozo-background-upload')?.addEventListener('click', uploadBozoBackground);
$('bozo-background-remove')?.addEventListener('click', removeBozoBackground);
$('bozo-plus-save-colors')?.addEventListener('click', saveBozoPlusColor);
$('bozo-name-color-picker')?.addEventListener('input', event => {
  $('bozo-name-color-hex').value = event.target.value;
});
$('bozo-name-color-hex')?.addEventListener('input', event => {
  if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) $('bozo-name-color-picker').value = event.target.value;
});
$('bozo-name-color-presets')?.addEventListener('click', event => {
  const button = event.target.closest('[data-bozo-color]');
  if (!button) return;
  $('bozo-name-color-picker').value = button.dataset.bozoColor;
  $('bozo-name-color-hex').value = button.dataset.bozoColor;
});




let myChessProfile = { ratings: [], games: [] };
let friendChessProfile = { ratings: [], games: [] };

function prettyPool(pool='') {
  return String(pool).charAt(0).toUpperCase() + String(pool).slice(1);
}

function formatTimeControl(game={}) {
  const base = Number(game.base_seconds || 0);
  const inc = Number(game.increment_seconds || 0);
  if (!base) return 'Rated';
  const minutes = base % 60 === 0 ? String(base / 60) : (base / 60).toFixed(1);
  return `${minutes}+${inc}`;
}

function resultForPerspective(game={}) {
  if (game.result === '1/2-1/2') return { label: 'Draw', tone: 'draw' };
  const won = (game.color === 'white' && game.result === '1-0') ||
              (game.color === 'black' && game.result === '0-1');
  return won ? { label: 'Win', tone: 'win' } : { label: 'Loss', tone: 'loss' };
}

function ratingGridMarkup(ratings=[]) {
  const byPool = new Map((ratings || []).map(row => [row.pool, row]));
  return ['bullet','blitz','rapid','classical'].map(pool => {
    const row = byPool.get(pool);
    if (!row) {
      return `<article class="profile-rating-card">
        <span>${prettyPool(pool)}</span><b> - </b><small>Not initialized</small>
      </article>`;
    }
    const display = row.display_rating ?? (row.rating != null ? Math.round(Number(row.rating)) : ' - ');
    const detail = row.is_established
      ? `${Number(row.wins || 0)}W ${Number(row.losses || 0)}L ${Number(row.draws || 0)}D`
      : `Placement ${Number(row.placement_games || 0)}/10`;
    return `<article class="profile-rating-card">
      <span>${prettyPool(pool)}</span>
      <b>${escapeHtml(String(display))}</b>
      <small>${escapeHtml(detail)}</small>
    </article>`;
  }).join('');
}

function gameHistoryMarkup(games=[], limit=null, emptyText='No rated games yet.') {
  const rows = limit ? (games || []).slice(0, limit) : (games || []);
  if (!rows.length) {
    return `<div class="empty-state mini"><b>Nothing here yet</b><span>${escapeHtml(emptyText)}</span></div>`;
  }

  return rows.map(game => {
    const result = resultForPerspective(game);
    const change = game.rating_change;
    const changeText = change == null ? '' : `${Number(change) >= 0 ? '+' : ''}${Number(change)}`;
    const date = game.created_at ? new Date(game.created_at) : null;
    const dateText = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
      : '';
    return `<article class="profile-game-row">
      <div class="profile-game-result ${result.tone}">${result.label}</div>
      <img src="${escapeHtml(game.opponent_avatar || './assets/bozo-mascot.webp')}" alt="">
      <div class="profile-game-main">
        <b>${escapeHtml(game.opponent_ign || game.opponent_username || 'Opponent')}</b>
        <span>@${escapeHtml(game.opponent_username || 'opponent')} · ${escapeHtml(prettyPool(game.pool))} ${escapeHtml(formatTimeControl(game))}</span>
        <small>${escapeHtml(game.color === 'white' ? 'White' : 'Black')} · ${escapeHtml(game.termination ? String(game.termination).replaceAll('_',' ') : 'completed')} · ${escapeHtml(dateText)}</small>
      </div>
      <div class="profile-game-rating">
        ${game.rating_after != null ? `<b>${Math.round(Number(game.rating_after))}</b>` : ''}
        ${changeText ? `<span class="${Number(change) >= 0 ? 'positive' : 'negative'}">${escapeHtml(changeText)}</span>` : ''}
      </div>
      ${game.pgn ? `<button class="button secondary small" type="button" data-review-history-game="${escapeHtml(game.id)}">Review</button>` : ''}
    </article>`;
  }).join('');
}

async function loadChessProfile(targetUsername=null) {
  if (!state.session?.user) return null;
  const { data, error } = await sb.rpc('get_chess_profile', {
    target_username: targetUsername || null
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ratings: Array.isArray(row?.ratings) ? row.ratings : [],
    games: Array.isArray(row?.games) ? row.games : []
  };
}

async function loadMyChessProfile() {
  const ratingGrid = $('profile-rating-grid');
  const recent = $('profile-recent-games');
  const history = $('profile-game-history');
  if (!state.session?.user) return;

  if (ratingGrid) ratingGrid.innerHTML = '<div class="empty-state mini"><span>Loading ratings…</span></div>';
  if (recent) recent.innerHTML = '<div class="empty-state mini"><span>Loading games…</span></div>';
  if (history) history.innerHTML = '<div class="empty-state mini"><span>Loading games…</span></div>';

  try {
    myChessProfile = await loadChessProfile(null) || { ratings: [], games: [] };
    if (ratingGrid) ratingGrid.innerHTML = ratingGridMarkup(myChessProfile.ratings);
    if (recent) recent.innerHTML = gameHistoryMarkup(myChessProfile.games, 5, 'Your completed rated games will appear here.');
    if (history) history.innerHTML = gameHistoryMarkup(myChessProfile.games, null, 'Your completed rated games will appear here.');
  } catch (error) {
    console.warn('Could not load chess profile:', error);
    const msg = escapeHtml(readableError(error));
    if (ratingGrid) ratingGrid.innerHTML = `<div class="empty-state mini"><b>Ratings unavailable</b><span>${msg}</span></div>`;
    if (recent) recent.innerHTML = `<div class="empty-state mini"><b>History unavailable</b><span>${msg}</span></div>`;
    if (history) history.innerHTML = `<div class="empty-state mini"><b>History unavailable</b><span>${msg}</span></div>`;
  }
}

function setProfileTab(name='overview') {
  $$('[data-profile-tab]').forEach(button => button.classList.toggle('active', button.dataset.profileTab === name));
  $('profile-overview-tab').hidden = name !== 'overview';
  $('profile-games-tab').hidden = name !== 'games';
  $('profile-settings-tab').hidden = name !== 'settings';
}

function setFriendProfileTab(name='overview') {
  $$('[data-friend-profile-tab]').forEach(button => button.classList.toggle('active', button.dataset.friendProfileTab === name));
  $('friend-profile-overview-tab').hidden = name !== 'overview';
  $('friend-profile-ratings-tab').hidden = name !== 'ratings';
  $('friend-profile-games-tab').hidden = name !== 'games';
  document.querySelector('.friend-profile-scroll')?.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function cleanPgnTagValue(value='') {
  return String(value ?? '').replace(/[\\\"]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeRatedReviewPgn(game={}) {
  const raw = String(game.pgn || '').trim();
  if (!raw) return '';

  let movetext = raw
    .split(/\r?\n/)
    .filter(line => !/^\s*\[[^\]]+\]\s*$/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const result = ['1-0','0-1','1/2-1/2'].includes(String(game.result))
    ? String(game.result)
    : '*';

  movetext = movetext.replace(/\s+(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();
  if (result) movetext = `${movetext} ${result}`.trim();

  const meIgn = cleanPgnTagValue(state.profile?.ign || state.profile?.username || 'BOZO Player');
  const opponentIgn = cleanPgnTagValue(game.opponent_ign || game.opponent_username || 'Opponent');
  const white = game.color === 'black' ? opponentIgn : meIgn;
  const black = game.color === 'black' ? meIgn : opponentIgn;

  const dateObj = game.created_at ? new Date(game.created_at) : new Date();
  const date = Number.isNaN(dateObj.getTime())
    ? '????.??.??'
    : `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;

  const base = Number(game.base_seconds || 0);
  const increment = Number(game.increment_seconds || 0);
  const timeControl = base > 0 ? `${base}+${increment}` : '-';
  const termination = cleanPgnTagValue(game.termination || 'normal');

  const headers = [
    `[Event "BOZO Rated Game"]`,
    `[Site "BOZO"]`,
    `[Date "${date}"]`,
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    `[TimeControl "${timeControl}"]`,
    `[Termination "${termination}"]`
  ];

  return `${headers.join('\n')}\n\n${movetext}`;
}

function historyGameById(id) {
  return [...(myChessProfile.games || []), ...(friendChessProfile.games || [])].find(game => String(game.id) === String(id));
}

function openHistoricalGameReview(gameId) {
  const game = historyGameById(gameId);
  if (!game?.pgn) return toast('That game does not have a saved PGN.');
  closeFriendProfile();
  route('review');
  setTimeout(() => {
    $('review-pgn-input').value = normalizeRatedReviewPgn(game);
    $('review-import-message').textContent = `Rated game vs @${game.opponent_username || 'opponent'} loaded from Game History with clean match headers.`;
    $('review-pgn-input').scrollIntoView({ behavior:'smooth', block:'center' });
  }, 100);
}

document.addEventListener('click', event => {
  const profileTab = event.target.closest('[data-profile-tab]');
  if (profileTab) {
    setProfileTab(profileTab.dataset.profileTab);
    return;
  }

  const friendTab = event.target.closest('[data-friend-profile-tab]');
  if (friendTab) {
    setFriendProfileTab(friendTab.dataset.friendProfileTab);
    return;
  }

  const reviewButton = event.target.closest('[data-review-history-game]');
  if (reviewButton) {
    openHistoricalGameReview(reviewButton.dataset.reviewHistoryGame);
  }
});

$('profile-view-all-games')?.addEventListener('click', () => setProfileTab('games'));
$('profile-games-refresh')?.addEventListener('click', loadMyChessProfile);


function renderProfile() {
  const signedIn = Boolean(state.session?.user);
  $('profile-guest').hidden = signedIn;
  $('profile-user').hidden = !signedIn;
  if (!signedIn) return;

  const p = state.profile || {};
  const avatarUrl = p.avatar_url || PROFILE_AVATAR_FALLBACK;
  $('profile-avatar').src = avatarUrl;
  $('profile-avatar').onerror = () => { $('profile-avatar').src = PROFILE_AVATAR_FALLBACK; };
  if (!pendingAvatarBlob) $('profile-avatar-preview').src = avatarUrl;
  $('profile-avatar-preview').onerror = () => { $('profile-avatar-preview').src = PROFILE_AVATAR_FALLBACK; };
  $('profile-avatar-remove').disabled = !p.avatar_url;
  if (!pendingAvatarBlob) setAvatarStatus(p.avatar_url ? 'Current profile picture is saved to your account.' : 'Using the BOZO mascot.');
  $('profile-ign').textContent = p.ign || 'Player';
  $('profile-username').textContent = '@' + (p.username || 'username');
  const titleRow = $('profile-title-row');
  if (titleRow) {
    const titles = [p.chess_title, p.bozo_title].filter(Boolean);
    const roleChip = state.role === 'owner'
      ? '<span class="profile-title-chip role-owner">OWNER</span>'
      : (['administrator','senior_moderator','moderator','reviewer','staff'].includes(state.role)
          ? '<span class="profile-title-chip role-staff">STAFF</span>' : '');
    const flag = p.country_code ? `<span class="profile-country-chip" title="${escapeHtml(p.country_code)}">${countryFlagImage(p.country_code,'profile-country-flag')}</span>` : '';
    titleRow.innerHTML = titles.map(t => `<span class="profile-title-chip">${escapeHtml(t)}</span>`).join('') +
      roleChip +
      (p.identity_verified ? '<span class="profile-verified-chip" title="Identity verified by BOZO">✓ Verified</span>' : '') +
      flag + flairMarkup(p);
  }
  paintProfileRoleFlair(state.role);
  $('profile-supporter-badge').hidden = !isBozoSupporter(p);
  $('profile-ign').style.color = isBozoSupporter(p) ? validBozoNameColor(p.name_color) : '';
  applyProfileCosmetics(document.querySelector('.profile-hero'), p);
  paintBozoPlusSettings();
  $('profile-ign-input').value = p.ign || '';
  $('profile-username-input').value = p.username || '';
  $('profile-bio-input').value = p.bio || '';
  populateCountrySelector();
  if ($('profile-country-search')) $('profile-country-search').value = '';
  $('profile-country-input').value = p.country_code || '';
  selectedEmojiFlair = p.emoji_flair || '';
  $('profile-flair-input').value = p.emoji_flair ? 'emoji' : (p.selected_flair || '');
  $('emoji-flair-picker').hidden = !p.emoji_flair;
  $('emoji-flair-custom').value = p.emoji_flair || '';
  if (p.emoji_flair) paintEmojiFlairPicker();
  $('profile-personality-input').value = p.opening_personality || 'Explorer';
  loadRepertoireOpeningOptions().then(() => {
    setOpeningPickerValue('profile-white-opening-input', p.favorite_white_opening);
    setOpeningPickerValue('profile-black-e4-opening-input', p.favorite_black_e4_opening);
    setOpeningPickerValue('profile-black-d4-opening-input', p.favorite_black_d4_opening);
  });
  $('profile-email').textContent = state.session.user.email || '';
  $('profile-user-id').textContent = state.session.user.id;
  loadMyReports();
  loadMyChessProfile();
}

async function loadMyReports() {
  const list = $('profile-reports-list');
  if (!list || !state.session?.user) return;
  list.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading reports…</b></div>';
  const uid = state.session.user.id;
  const { data, error } = await sb.from('reports')
    .select('id,report_type,severity,reason,status,created_at,updated_at')
    .or(`reporter_id.eq.${uid},reported_by.eq.${uid}`)
    .order('created_at', { ascending:false })
    .limit(25);
  if (error) {
    list.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load reports</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }
  list.innerHTML = (data || []).map(report => `<article class="profile-report-row">
    <div><b>${escapeHtml((report.report_type || 'issue').replaceAll('_',' '))}</b><p>${escapeHtml(report.reason || '')}</p><small>${new Date(report.created_at).toLocaleString()}</small></div>
    <span class="report-status report-status-${escapeHtml(report.status || 'open')}">${escapeHtml(reportStatusLabel(report.status))}</span>
  </article>`).join('') || '<div class="empty-state"><div>✓</div><b>No reports submitted</b><span>Issues you report will appear here.</span></div>';
}
$('profile-reports-refresh')?.addEventListener('click', loadMyReports);

$('profile-title-submit')?.addEventListener('click', async () => {
  const requested_title = $('profile-title-request').value;
  const evidence = $('profile-title-evidence').value.trim();
  if (!requested_title) return toast('Choose a title to request.');
  if (!evidence) return toast('Add a federation ID or verification link.');
  const { error } = await sb.rpc('submit_title_verification_request', { requested_title, evidence_text: evidence });
  if (error) return toast(readableError(error));
  $('profile-title-status').textContent = `${requested_title} verification pending. Only staff can see the claim until approved.`;
  toast('Verification request submitted.');
});

$('profile-save-button').addEventListener('click', async () => {
  const ign = $('profile-ign-input').value.trim();
  const username = $('profile-username-input').value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');

  if (username.length < 3) return toast('Username must be at least 3 characters.');

  const ignModeration = validateBozoName(ign, 'IGN');
  if (ignModeration) return toast(ignModeration);

  const usernameModeration = validateBozoName(username, 'Username');
  if (usernameModeration) return toast(usernameModeration);

  const selectedFlair = $('profile-flair-input').value;
  if (BOZO_PLUS_FLAIRS.has(selectedFlair) && !isBozoSupporter()) {
    return toast('That flair is a BOZO+ cosmetic.');
  }
  const emojiFlair = selectedFlair === 'emoji' ? String(selectedEmojiFlair || '').trim() : '';
  if (selectedFlair === 'emoji') {
    if (!looksLikeSingleEmoji(emojiFlair)) return toast('Choose or paste one emoji flair.');
    if (BOZO_BLOCKED_EMOJI.has(emojiFlair)) return toast('That emoji flair is not allowed.');
  }

  const { error } = await sb.from('profiles').update({
    ign,
    username,
    bio: $('profile-bio-input').value.trim(),
    country_code: $('profile-country-input').value || null,
    selected_flair: selectedFlair === 'emoji' ? null : (selectedFlair || null),
    emoji_flair: emojiFlair || null,
    opening_personality: $('profile-personality-input').value,
    favorite_white_opening: $('profile-white-opening-input').value || null,
    favorite_black_e4_opening: $('profile-black-e4-opening-input').value || null,
    favorite_black_d4_opening: $('profile-black-d4-opening-input').value || null
  }).eq('id', state.session.user.id);

  if (error) return toast(readableError(error));
  await logActivity('profile_updated', {});
  await loadIdentity();
  toast('Profile saved');
});

$('sign-out-button').addEventListener('click', async () => {
  await sb.auth.signOut();
  route('home');
  toast('Signed out');
});

async function loadAnnouncement() {
  if (!state.session) return $('announcement-card').hidden = true;
  const { data, error } = await sb.from('announcements')
    .select('id,title,body,created_at').eq('is_active', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  if (error || !data) return $('announcement-card').hidden = true;
  const dismissalKey = `bozo-dismissed-announcement:${data.id || data.created_at || data.title}`;
  if (localStorage.getItem(dismissalKey) === '1') {
    $('announcement-card').hidden = true;
    return;
  }
  $('announcement-title').textContent = data.title;
  $('announcement-body').textContent = data.body;
  $('announcement-card').dataset.dismissalKey = dismissalKey;
  $('announcement-card').hidden = false;
}

$('announcement-dismiss')?.addEventListener('click', () => {
  const card = $('announcement-card');
  if (card?.dataset.dismissalKey) localStorage.setItem(card.dataset.dismissalKey, '1');
  if (card) card.hidden = true;
});

const OPENING_DISCOVERY_TAGS = new Set(['white','black','positional','tactical','aggressive','gambit','system']);
const openingBrowserFilters = new Set();
let openingLibraryRows = [];
let openingTargetElo = null;

$('opening-search-button').addEventListener('click', () => searchOpenings($('opening-search-input').value));
$('opening-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchOpenings(e.target.value); });
$('opening-search-input').addEventListener('input', () => {
  if (!$('opening-search-input').value.trim() && openingLibraryRows.length) renderOpeningBrowserRows(openingLibraryRows, '');
});

document.querySelectorAll('[data-opening-filter]').forEach(button => {
  button.addEventListener('click', () => {
    const tag = button.dataset.openingFilter;
    if (openingBrowserFilters.has(tag)) openingBrowserFilters.delete(tag);
    else openingBrowserFilters.add(tag);
    syncOpeningFilterChips();
    searchOpenings($('opening-search-input').value);
  });
});


$('opening-elo-recommend')?.addEventListener('click', () => {
  const value=Number($('opening-elo-input')?.value);
  if(!Number.isFinite(value) || value<300 || value>3000) return toast('Enter a rating from 300 to 3000.');
  openingTargetElo=Math.round(value);
  $('opening-search-input').value = String(openingTargetElo);
  searchOpenings(String(openingTargetElo));
});

$('opening-elo-input')?.addEventListener('keydown', e => {
  if(e.key==='Enter') $('opening-elo-recommend')?.click();
});

document.querySelectorAll('[data-opening-elo]').forEach(button => {
  button.addEventListener('click', () => {
    openingTargetElo=Number(button.dataset.openingElo);
    if($('opening-elo-input')) $('opening-elo-input').value=String(openingTargetElo);
    $('opening-search-input').value=String(openingTargetElo);
    searchOpenings(String(openingTargetElo));
  });
});

$('opening-filter-clear')?.addEventListener('click', () => {
  openingBrowserFilters.clear();
  openingTargetElo = null;
  if($('opening-elo-input')) $('opening-elo-input').value='';
  $('opening-search-input').value = '';
  syncOpeningFilterChips();
  searchOpenings('');
});

function syncOpeningFilterChips() {
  document.querySelectorAll('[data-opening-filter]').forEach(button => {
    button.classList.toggle('active', openingBrowserFilters.has(button.dataset.openingFilter));
  });
}

function parseOpeningDiscoveryQuery(query = '') {
  const words = String(query).trim().split(/\s+/).filter(Boolean);
  const textWords = [];
  const tags = new Set(openingBrowserFilters);
  let elo = openingTargetElo;

  for (let i=0;i<words.length;i++) {
    const word=words[i];
    const cleaned=word.toLowerCase().replace(/[,]/g,'');
    const numeric=/^(\d{3,4})(?:elo)?$/.exec(cleaned);
    if (numeric) {
      const value=Number(numeric[1]);
      if(value>=300 && value<=3000) { elo=value; continue; }
    }
    if (/^elo$/i.test(word) && i>0 && /^\d{3,4}$/.test(words[i-1])) continue;

    const normalized = word.toLowerCase().replace(/[^a-z-]/g, '');
    if (OPENING_DISCOVERY_TAGS.has(normalized)) tags.add(normalized);
    else textWords.push(word);
  }

  return { text: textWords.join(' ').trim(), tags, elo };
}

function openingMoveSans(pgn = '') {
  return String(pgn)
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+\.(?:\.\.)?/g, ' ')
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
}

function explicitOpeningSide(opening = {}) {
  const definition = typeof matchingBozoOpeningDefinition === 'function' ? matchingBozoOpeningDefinition(opening) : null;
  const raw = definition?.repertoire_side
    || opening?.metadata?.repertoire_side
    || opening?.metadata?.repertoireSide
    || opening?.metadata?.side
    || '';
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'white' || normalized === 'w') return 'white';
  if (normalized === 'black' || normalized === 'b') return 'black';
  return '';
}

function inferOpeningSide(opening = {}) {
  const explicit = explicitOpeningSide(opening);
  if (explicit) return explicit;
  const text = `${opening.name || ''} ${opening.variation || ''}`.toLowerCase();
  if (/defen[sc]e|countergambit|sicilian|caro-kann|french|scandinavian|pirc|alekhine|petrov|philidor|gr[uü]nfeld|benoni|dutch/.test(text)) return 'black';
  if (/opening|attack|system|gambit|game|london|catalan|english|bird|polish|r[ée]ti|vienna|italian|spanish/.test(text)) return 'white';
  return 'neutral';
}

function openingDiscoveryTags(opening = {}) {
  const tags = new Set();
  const side = inferOpeningSide(opening);
  if (side !== 'neutral') tags.add(side);
  const text = `${opening.name || ''} ${opening.variation || ''} ${opening.notes || ''}`.toLowerCase();

  if (/gambit|countergambit/.test(text)) tags.add('gambit');
  if (/attack|gambit|countergambit|gro[b]?|wing|dragon|najdorf|fried liver|smith-morra|evans|marshall|four pawns/.test(text)) tags.add('aggressive');
  if (/gambit|countergambit|trap|sacrifice|sharp|attack|fried liver|smith-morra|evans|marshall/.test(text)) tags.add('tactical');
  if (/system|closed|declined|slav|caro-kann|london|catalan|queen'?s indian|nimzo|r[ée]ti|english|stonewall|colle|hedgehog|petrov/.test(text)) tags.add('positional');
  if (/system|london|colle|stonewall|hippopotamus/.test(text)) tags.add('system');
  if (!tags.has('tactical') && !tags.has('aggressive')) tags.add('positional');
  return tags;
}


function openingMetadataNumber(opening,keyVariants=[]) {
  for(const key of keyVariants){
    const raw=opening?.metadata?.[key];
    const n=Number(raw);
    if(Number.isFinite(n)) return n;
  }
  return null;
}

function openingLearningProfile(opening={}) {
  const text=`${opening.name||''} ${opening.variation||''} ${opening.notes||''}`.toLowerCase();
  const tags=openingDiscoveryTags(opening);

  const columnMin=Number(opening?.recommended_min_elo);
  const columnMax=Number(opening?.recommended_max_elo);
  const metaMin=Number.isFinite(columnMin) ? columnMin : openingMetadataNumber(opening,['min_recommended_elo','recommended_min_elo','minElo','min_elo']);
  const metaMax=Number.isFinite(columnMax) ? columnMax : openingMetadataNumber(opening,['max_recommended_elo','recommended_max_elo','maxElo','max_elo']);
  const metaTheory=openingMetadataNumber(opening,['theory_load','theoryLoad']);
  const metaTactical=openingMetadataNumber(opening,['tactical_demand','tacticalDemand']);
  const metaPositional=openingMetadataNumber(opening,['positional_demand','positionalDemand']);
  const metaClarity=openingMetadataNumber(opening,['plan_clarity','planClarity']);

  let min=700,max=1900,theory=3,tactical=3,positional=3,clarity=3;
  let reason='Balanced theory and plans make this suitable for a broad range of improving players.';

  const set=(a,b,t,ta,po,c,r)=>{min=a;max=b;theory=t;tactical=ta;positional=po;clarity=c;reason=r;};

  if(/italian game|giuoco piano/.test(text))
    set(400,1800,2,3,2,5,'Natural development and clear king-safety ideas make the Italian a strong place to learn opening fundamentals.');
  else if(/london system/.test(text))
    set(400,1800,2,2,3,5,'A repeatable setup and clear piece placement reduce the amount of theory a developing player must memorize.');
  else if(/scotch game/.test(text))
    set(600,1800,3,4,2,4,'The Scotch teaches central play in open positions with plans that are easier to see than in many closed openings.');
  else if(/vienna game/.test(text))
    set(600,1800,3,4,2,4,'The Vienna combines normal development with direct attacking chances without requiring the heaviest theory.');
  else if(/queen'?s gambit/.test(text))
    set(800,2300,4,2,5,4,'The Queen’s Gambit rewards understanding of the center and pawn structure, making it especially useful once basic principles are comfortable.');
  else if(/caro-kann/.test(text))
    set(600,2100,3,2,4,4,'The Caro-Kann gives Black a reliable structure and clear development plans while avoiding some of the sharpest early theory.');
  else if(/scandinavian/.test(text))
    set(400,1600,2,3,2,4,'The Scandinavian gives Black an immediate central plan and relatively easy-to-recognize positions.');
  else if(/french defen[sc]e/.test(text))
    set(800,2200,4,3,5,3,'The French is sound and thematic, but its pawn chains and piece-placement problems reward some prior positional experience.');
  else if(/king'?s indian/.test(text))
    set(1200,2500,5,5,5,2,'The King’s Indian is powerful but demands comfort with closed centers, pawn breaks, and attacks where timing matters.');
  else if(/sicilian/.test(text))
    set(1100,2600,5,5,4,2,'The Sicilian creates rich winning chances, but the asymmetrical structures and large theory tree make it harder as a first defense.');
  else if(/gr[uü]nfeld/.test(text))
    set(1500,2700,5,5,5,2,'The Grünfeld relies on concrete theory and dynamic pressure against the center, so it fits stronger players better.');
  else if(/nimzo-indian/.test(text))
    set(1200,2500,5,3,5,3,'The Nimzo-Indian is strategically rich and rewards players who already understand structure, development, and long-term imbalances.');
  else if(/english opening|r[ée]ti/.test(text))
    set(900,2300,4,2,5,3,'Flexible move orders are valuable, but they ask the player to understand several structures rather than follow one fixed setup.');
  else if(/polish opening|sokolsky|1\\.b4/.test(text))
    set(600,1900,3,3,3,4,'The Polish gives a clear queenside idea and unusual positions, while still teaching development and long-diagonal play.');
  else if(tags.has('system'))
    set(400,1700,2,2,3,5,'A system opening offers repeatable development plans and a lower early theory burden.');
  else if(tags.has('gambit'))
    set(700,1900,3,5,2,4,'Gambits are useful for learning initiative and development, but they reward accurate calculation when material is invested.');
  else if(tags.has('tactical') || tags.has('aggressive'))
    set(800,2100,4,5,2,3,'This opening creates tactical chances early, which is valuable once the player is comfortable calculating forcing lines.');
  else if(tags.has('positional'))
    set(700,2200,3,2,5,4,'This opening emphasizes structure and piece placement, making it useful for players building positional habits.');

  if(metaMin!=null) min=metaMin;
  if(metaMax!=null) max=metaMax;
  if(metaTheory!=null) theory=metaTheory;
  if(metaTactical!=null) tactical=metaTactical;
  if(metaPositional!=null) positional=metaPositional;
  if(metaClarity!=null) clarity=metaClarity;

  const difficulty =
    theory>=5 || tactical>=5 || positional>=5 ? 'Advanced'
    : theory<=2 && tactical<=3 && clarity>=4 ? 'Beginner friendly'
    : 'Intermediate';

  return {min,max,theory,tactical,positional,clarity,difficulty,reason};
}

function openingEloFit(opening,elo) {
  if(!Number.isFinite(Number(elo))) return {score:1,profile:openingLearningProfile(opening),distance:0};
  const target=Number(elo), profile=openingLearningProfile(opening);
  let distance=0;
  if(target<profile.min) distance=profile.min-target;
  else if(target>profile.max) distance=target-profile.max;

  // Full score inside the recommended range, then decay gradually rather than
  // pretending an opening becomes unplayable at a hard boundary.
  const score=distance===0 ? 1 : Math.max(0,1-distance/900);
  return {score,profile,distance};
}

function openingEloBadgeMarkup(opening,targetElo=null) {
  const fit=openingEloFit(opening,targetElo);
  const p=fit.profile;
  const target=Number(targetElo);
  const fitLabel=Number.isFinite(target)
    ? (fit.distance===0 ? `Strong fit for ${target}` : `Possible at ${target}`)
    : `BOZO range ${p.min}–${p.max}`;
  return `<div class="opening-elo-fit ${fit.distance===0?'recommended':''}">
    <span>${escapeHtml(fitLabel)}</span>
    <small>${p.min}–${p.max} Elo · ${escapeHtml(p.difficulty)}</small>
  </div>`;
}

function openingMatchesDiscovery(opening, tags) {
  if (!tags?.size) return true;
  const openingTags = openingDiscoveryTags(opening);
  return [...tags].every(tag => openingTags.has(tag));
}

function renderOpeningBrowserRows(rows, query = '') {
  const target = $('opening-results');
  const parsed = parseOpeningDiscoveryQuery(query);
  let filtered = rows.filter(opening => openingMatchesDiscovery(opening, parsed.tags));

  // A rating search is recommendation discovery, not a claim that other openings
  // are unplayable. Keep close fits and sort strongest fits first.
  if(Number.isFinite(Number(parsed.elo))){
    const targetElo=Number(parsed.elo);
    filtered=filtered
      .map(opening=>({opening,fit:openingEloFit(opening,targetElo)}))
      .filter(x=>x.fit.score>=.45)
      .sort((a,b)=>b.fit.score-a.fit.score || b.fit.profile.clarity-a.fit.profile.clarity || a.opening.name.localeCompare(b.opening.name))
      .map(x=>x.opening);
  }

  const summary = $('opening-filter-summary');
  if (summary) {
    const active = [...parsed.tags];
    const eloText=Number.isFinite(Number(parsed.elo)) ? ` · recommended around ${Number(parsed.elo)} Elo` : '';
    summary.textContent = active.length
      ? `${filtered.length.toLocaleString()} matching lines · ${active.map(tag => tag[0].toUpperCase() + tag.slice(1)).join(' + ')}${eloText}`
      : `${filtered.length.toLocaleString()} published lines${eloText}.`;
  }

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state"><div>♟</div><b>No openings match those filters</b><span>Try a nearby rating, remove a style filter, or search a broader opening name.</span></div>`;
    return;
  }

  let families = groupOpeningFamilies(filtered);
  if(Number.isFinite(Number(parsed.elo))){
    const targetElo=Number(parsed.elo);
    families=families.sort((a,b)=>{
      const af=openingEloFit(a.preview,targetElo),bf=openingEloFit(b.preview,targetElo);
      return bf.score-af.score || bf.profile.clarity-af.profile.clarity || a.name.localeCompare(b.name);
    });
  }
  target.dataset.targetElo = Number.isFinite(Number(parsed.elo)) ? String(Number(parsed.elo)) : '';
  target.innerHTML = families.map(renderOpeningFamily).join('');
  window.BozoMastery?.refreshAll?.();

  target.querySelectorAll('[data-family-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const familyId = button.dataset.familyToggle;
      const body = document.querySelector(`[data-family-body="${familyId}"]`);
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      body.hidden = expanded;
      button.querySelector('.family-toggle-label').textContent =
        expanded ? `Browse variations (${body.dataset.count})` : 'Hide variations';
      button.querySelector('.family-chevron').textContent = expanded ? '⌄' : '⌃';
    });
  });
}

async function searchOpenings(query) {
  const target = $('opening-results');
  target.innerHTML = '<div class="empty-state"><div>⌛</div><b>Searching theory…</b></div>';
  const parsed = parseOpeningDiscoveryQuery(query);

  let req = sb.from('openings').select('id,eco,name,variation,pgn,source_type,notes,metadata,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('status','published').limit(10000);
  if (parsed.text) req = req.or(`name.ilike.%${parsed.text}%,variation.ilike.%${parsed.text}%,eco.ilike.%${parsed.text}%`);
  const { data, error } = await req.order('name');

  if (error) {
    target.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load the cloud library</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }

  if (!data?.length) {
    target.innerHTML = `<div class="empty-state"><div>📚</div><b>No published cloud openings found</b><span>Try another opening name or clear the filters.</span></div>`;
    return;
  }

  openingLibraryRows = data;
  renderOpeningBrowserRows(data, query);
}

function familyBaseName(name = '') {
  const colon = name.indexOf(':');
  return (colon === -1 ? name : name.slice(0, colon)).trim() || 'Unnamed Opening';
}

function variationLabel(opening) {
  if (opening.variation?.trim()) return opening.variation.trim();
  const base = familyBaseName(opening.name);
  if (opening.name.startsWith(base + ':')) {
    return opening.name.slice(base.length + 1).trim();
  }
  return opening.name === base ? 'Main Line' : opening.name;
}

function moveCount(pgn = '') {
  return (pgn.match(/\d+\./g) || []).length;
}

function groupOpeningFamilies(openings) {
  const map = new Map();

  for (const opening of openings) {
    const base = familyBaseName(opening.name);
    const key = base.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        id: `family-${key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        name: base,
        ecos: new Set(),
        sourceTypes: new Set(),
        lines: []
      });
    }

    const family = map.get(key);
    if (opening.eco) family.ecos.add(opening.eco);
    if (opening.source_type) family.sourceTypes.add(opening.source_type);
    family.lines.push({
      ...opening,
      displayVariation: variationLabel(opening),
      moveCount: moveCount(opening.pgn)
    });
  }

  return Array.from(map.values())
    .map(family => {
      family.lines.sort((a, b) => {
        const aMain = a.displayVariation === 'Main Line' ? 0 : 1;
        const bMain = b.displayVariation === 'Main Line' ? 0 : 1;
        return aMain - bMain ||
          a.moveCount - b.moveCount ||
          a.displayVariation.localeCompare(b.displayVariation);
      });

      const richest = [...family.lines].sort((a, b) =>
        b.moveCount - a.moveCount ||
        (b.pgn?.length || 0) - (a.pgn?.length || 0)
      )[0];

      return {
        ...family,
        ecos: Array.from(family.ecos).sort(),
        sourceTypes: Array.from(family.sourceTypes),
        preview: richest
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatPreviewMoves(pgn = '', fullMoves = 4) {
  const safe = escapeHtml(pgn);
  const tokens = safe.trim().split(/\s+/);
  const rows = [];
  let current = '';

  for (const token of tokens) {
    if (/^\d+\.$/.test(token)) {
      if (current) rows.push(current.trim());
      current = token;
    } else {
      current += ` ${token}`;
    }
    if (rows.length >= fullMoves) break;
  }

  if (current && rows.length < fullMoves) rows.push(current.trim());
  return rows.slice(0, fullMoves).join('<br>');
}

function openChallengeForOpening(name) {
  route('challenges');
  setTimeout(() => {
    openNewGameSetup('friend');
    $('duel-opening-search').value = name;
    searchDuelOpenings();
  }, 80);
}

function openBotForOpening(name) {
  route('challenges');
  setTimeout(() => {
    openNewGameSetup('bot');
    $('duel-opening-search').value = name;
    searchDuelOpenings();
  }, 80);
}

function openStudyById(openingId) {
  openStudyOpening(openingId);
}

function openingTagMarkup(opening) {
  const tags = [...openingDiscoveryTags(opening)].filter(tag => ['white','black','positional','tactical','aggressive','gambit','system'].includes(tag));
  return tags.slice(0, 4).map(tag => `<span class="opening-style-tag ${tag}">${escapeHtml(tag)}</span>`).join('');
}

function responseButtonLabel(opening) {
  const side = inferOpeningSide(opening);
  if (side === 'white') return 'Common Black responses';
  if (side === 'black') return 'Common White responses';
  return 'Common responses';
}

function renderOpeningFamily(family) {
  const lineCount = family.lines.length;
  const single = lineCount === 1;
  const visibleEcos = family.ecos.slice(0, 4).join(', ');
  const extraEcos = family.ecos.length > 4 ? ` +${family.ecos.length - 4}` : '';
  const officialCount = family.lines.filter(line => line.source_type === 'official').length;
  const bozoCount = family.lines.filter(line => line.source_type === 'bozo').length;
  const preview = family.preview;
  const challengeName = `${preview.name}${preview.variation ? ': ' + preview.variation : ''}`;
  const escapedChallengeName = escapeHtml(challengeName).replace(/'/g, "\\'");
  const escapedFamilyName = escapeHtml(family.name).replace(/'/g, "\\'");

  const moreMenu = ({ openingId, labelSource, compact = false }) => `
    <details class="opening-more-menu ${compact ? 'compact' : ''}">
      <summary aria-label="More actions for ${escapeHtml(labelSource)}">
        <span>More</span>
        <span class="opening-more-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="opening-more-popover">
        <button class="response-repertoire-button"
                onclick="openResponseRepertoire('${openingId}')">
          <span class="more-action-title">${responseButtonLabel(preview)}</span>
          <small>Explore the most common replies.</small>
        </button>
        <button class="family-bot-button"
                onclick="openBotForOpening('${escapeHtml(labelSource).replace(/'/g, "\\'")}')">
          <span class="more-action-title">Play bot</span>
          <small>Practice the opening in a game.</small>
        </button>
        <button class="train-opening-button" onclick="startTrainingOpening('${openingId}')">
          <span class="more-action-title">Train this opening</span>
          <small>Practice the repertoire from memory.</small>
        </button>
        <button class="opening-puzzle-button" onclick="startOpeningPuzzles('${openingId}')">
          <span class="more-action-title">Opening puzzles</span>
          <small>Train positions from this opening.</small>
        </button>
        <button class="family-practice-button"
                onclick="openChallengeForOpening('${escapeHtml(labelSource).replace(/'/g, "\\'")}')">
          <span class="more-action-title">Challenge</span>
          <small>Test yourself against another player.</small>
        </button>
      </div>
    </details>
  `;

  return `
    <article class="opening-family-card ${single ? 'single-line-family' : ''}">
      <div class="family-card-header">
        <div>
          <span class="family-meta">
            ${escapeHtml(visibleEcos || 'ECO  - ')}${extraEcos}
            · ${single ? 'OPENING LINE' : 'OPENING FAMILY'}
          </span>
          <h3>${escapeHtml(family.name)}</h3>
          <div class="opening-style-tags">${openingTagMarkup(preview)}</div>
          ${openingEloBadgeMarkup(preview, Number($('opening-results')?.dataset?.targetElo)||null)}
          <p>
            ${single ? '1 published line' : `${lineCount.toLocaleString()} variations`}
            ${officialCount ? ` · ${officialCount} official` : ''}
            ${bozoCount ? ` · ${bozoCount} BOZO` : ''}
          </p>
        </div>
        ${single ? '' : `<span class="family-count">${lineCount}</span>`}
      </div>

      <div class="opening-mastery-inline" data-mastery-opening="${preview.id}" data-mastery-name="${escapeHtml(challengeName)}">
        ${window.BozoMastery ? window.BozoMastery.cardMarkup(preview.id) : ''}
      </div>

      <div class="family-preview">
        <span>${escapeHtml(preview.displayVariation)}</span>
        <code>${formatPreviewMoves(preview.pgn || '', 4)}</code>
      </div>
      ${Number($('opening-results')?.dataset?.targetElo)
        ? `<div class="opening-elo-reason"><b>Why BOZO recommends it here</b><span>${escapeHtml(openingLearningProfile(preview).reason)}</span></div>`
        : ''}

      <div class="opening-action-dock ${single ? 'single' : 'family'}">
        <div class="opening-primary-actions">
          <button class="study-button" onclick="openStudyById('${preview.id}')">${single ? 'Study' : 'Study preview'}</button>
          <button class="opening-master-direct" onclick="openMasterGamesForOpening('${preview.id}','${escapeHtml(single ? challengeName : family.name).replace(/'/g, "\\'")}')"><span class="master-games-button-icon" aria-hidden="true">♜</span><span>Master games</span></button>
          ${single ? '' : `
            <button class="family-toggle"
                    data-family-toggle="${family.id}"
                    aria-expanded="false">
              <span class="family-toggle-label">Browse variations (${lineCount})</span>
              <span class="family-chevron">⌄</span>
            </button>
          `}
          ${moreMenu({ openingId: preview.id, labelSource: single ? challengeName : family.name })}
        </div>
      </div>

      ${communityOpeningActions(preview, single ? undefined : `Suggest a ${escapeHtml(family.name)} improvement`)}

      ${single ? '' : `
        <div class="family-lines"
             data-family-body="${family.id}"
             data-count="${lineCount}"
             hidden>
          ${family.lines.map((line, index) => {
            const lineChallengeName = `${line.name}${line.variation ? ': ' + line.variation : ''}`;
            return `
              <div class="family-line-row">
                <div class="line-index">${index + 1}</div>
                <div class="line-content">
                  <div class="line-heading">
                    <b>${escapeHtml(line.displayVariation)}</b>
                    <span>${escapeHtml(line.eco || 'ECO  - ')} · ${escapeHtml(line.source_type || 'official')}</span>
                  </div>
                  <div class="line-mastery-inline" data-mastery-opening="${line.id}" data-mastery-name="${escapeHtml(lineChallengeName)}">
                    ${window.BozoMastery ? window.BozoMastery.compactMarkup(line.id) : ''}
                  </div>
                  <code>${escapeHtml(line.pgn || '')}</code>
                  ${line.notes ? `<p>${escapeHtml(line.notes)}</p>` : ''}
                  <div class="line-action-row line-action-dock">
                    <button class="line-study-button" onclick="openStudyById('${line.id}')">Study</button>
                    <button class="line-master-button" onclick="openMasterGamesForOpening('${line.id}','${escapeHtml(lineChallengeName).replace(/'/g, "\\'")}')">♜ Master games</button>
                    ${moreMenu({ openingId: line.id, labelSource: lineChallengeName, compact: true })}
                  </div>
                  ${communityOpeningActions(line)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </article>
  `;
}


function oppositeRepertoireSide(side = '') {
  return String(side).toLowerCase() === 'black' ? 'White' : 'Black';
}

function sameMovePrefix(a, b, count) {
  if (a.length < count || b.length < count) return false;
  for (let i = 0; i < count; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function openResponseRepertoire(openingId) {
  const modal = $('response-repertoire-modal');
  const root = $('response-repertoire-root');
  const title = $('response-repertoire-title');
  const copy = $('response-repertoire-copy');
  if (!modal || !root) return;

  modal.hidden = false;
  root.innerHTML = '<div class="response-loading">Finding common replies…</div>';

  let selected = openingLibraryRows.find(row => String(row.id) === String(openingId));
  if (!selected) {
    const { data, error } = await sb.from('openings')
      .select('id,eco,name,variation,pgn,source_type,notes,metadata,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at')
      .eq('id', openingId).maybeSingle();
    if (error || !data) {
      root.innerHTML = `<div class="response-empty">Could not load this opening.<br>${escapeHtml(readableError(error || new Error('Opening not found')))}</div>`;
      return;
    }
    selected = data;
  }

  const ownerSide = inferOpeningSide(selected);
  const effectiveOwnerSide = ownerSide === 'neutral' ? 'white' : ownerSide;
  const trainingSide = oppositeRepertoireSide(effectiveOwnerSide);
  const selectedMoves = openingMoveSans(selected.pgn);
  const prefixCount = effectiveOwnerSide === 'black' ? 2 : 1;
  const responseIndex = prefixCount;
  const prefix = selectedMoves.slice(0, prefixCount);

  title.textContent = `Common responses to ${selected.name}`;
  copy.textContent = `Train as ${trainingSide} against this ${effectiveOwnerSide === 'white' ? 'White' : 'Black'} repertoire. Starting from ${prefix.join(' ') || 'the opening position'}.`;

  const { data: candidates, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,source_type,notes,metadata,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at')
    .eq('status','published')
    .limit(10000);
  if (error) {
    root.innerHTML = `<div class="response-empty">Could not load common replies.<br>${escapeHtml(readableError(error))}</div>`;
    return;
  }

  const groups = new Map();
  for (const candidate of candidates || []) {
    const moves = openingMoveSans(candidate.pgn);
    if (!sameMovePrefix(selectedMoves, moves, prefixCount)) continue;
    const reply = moves[responseIndex];
    if (!reply) continue;
    if (!groups.has(reply)) groups.set(reply, []);
    groups.get(reply).push({ ...candidate, moves });
  }

  const responses = [...groups.entries()]
    .map(([reply, lines]) => {
      lines.sort((a,b) => b.moves.length - a.moves.length || String(a.name).localeCompare(String(b.name)));
      return { reply, lines, representative: lines[0] };
    })
    .sort((a,b) => b.lines.length - a.lines.length || a.reply.localeCompare(b.reply))
    .slice(0, 12);

  if (!responses.length) {
    root.innerHTML = '<div class="response-empty">No alternate published responses were found from this starting position yet.</div>';
    return;
  }

  root.innerHTML = `
    <div class="response-repertoire-summary">
      <span>${responses.length} common replies</span>
      <span>Training side: <b>${trainingSide}</b></span>
    </div>
    <div class="response-repertoire-list">
      ${responses.map((item, index) => {
        const line = item.representative;
        return `<article class="response-repertoire-card">
          <div class="response-rank">${index + 1}</div>
          <div class="response-card-content">
            <div class="response-card-heading">
              <div><span>COMMON REPLY</span><h3>${escapeHtml(item.reply)}</h3></div>
              <span class="response-line-count">${item.lines.length} line${item.lines.length === 1 ? '' : 's'}</span>
            </div>
            <p>${escapeHtml(line.name)}${line.variation ? ` · ${escapeHtml(line.variation)}` : ''}</p>
            <code>${formatPreviewMoves(line.pgn || '', 4)}</code>
            <div class="response-card-actions">
              <button class="button primary" onclick="openResponseStudy('${line.id}','${trainingSide.toLowerCase()}')">Study as ${trainingSide}</button>
              <button class="button secondary" onclick="openStudyById('${line.id}')">View line</button>
            </div>
          </div>
        </article>`;
      }).join('')}
    </div>`;
}

function closeResponseRepertoire() {
  const modal = $('response-repertoire-modal');
  if (modal) modal.hidden = true;
}

$('close-response-repertoire')?.addEventListener('click', closeResponseRepertoire);
$('response-repertoire-modal')?.addEventListener('click', event => {
  if (event.target === $('response-repertoire-modal')) closeResponseRepertoire();
});

function openResponseStudy(openingId, side) {
  closeResponseRepertoire();
  openStudyOpening(openingId, { repertoireSide: side, orientation: side });
}


function communityOpeningActions(opening, suggestionLabel = 'Suggest an improvement') {
  const name = `${opening.name || 'Opening'}${opening.variation ? `: ${opening.variation}` : ''}`;
  return `<div class="community-action-row">
    <button type="button" class="suggest-opening-button"
      data-opening-id="${escapeHtml(String(opening.id || ''))}"
      data-opening-name="${escapeHtml(name)}"
      data-opening-pgn="${escapeHtml(opening.pgn || '')}">✎ ${suggestionLabel}</button>
    <button type="button" class="report-opening-button"
      data-opening-id="${escapeHtml(String(opening.id || ''))}"
      data-opening-name="${escapeHtml(name)}"
      data-opening-pgn="${escapeHtml(opening.pgn || '')}">⚑ Report issue</button>
  </div>`;
}

const SUGGESTION_TYPES = [
  ['incorrect_move','Incorrect move'],
  ['better_line','Better line or continuation'],
  ['missing_variation','Missing variation'],
  ['explanation','Explanation or plan'],
  ['grammar','Grammar or formatting'],
  ['other','Other improvement']
];
const REPORT_TYPES = [
  ['ai_coach','AI Coach response'],
  ['game_review','Game Review'],
  ['opening_content','Opening information'],
  ['ui_design','UI or design'],
  ['performance','Performance or loading'],
  ['account','Account or cloud sync'],
  ['broken_page','Broken page or feature'],
  ['accessibility','Accessibility problem'],
  ['copyright','Copyright concern'],
  ['spam','Spam or abuse'],
  ['suggestion','Feature suggestion'],
  ['other','Other issue']
];

const REPORT_SCREENSHOT_BUCKET = 'issue-screenshots';

function currentReportContext() {
  const context = {
    page_url: location.href,
    route: location.hash || '#home',
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    reported_at: new Date().toISOString()
  };
  try {
    if (typeof reviewData !== 'undefined' && reviewData?.rows?.length) {
      const row = reviewData.rows[Math.max(0, Math.min(reviewStepIndex || 0, reviewData.rows.length - 1))];
      context.fen = row?.fen || '';
      context.move_number = row?.ply ? Math.ceil(row.ply / 2) : null;
      context.pgn = document.getElementById('review-pgn-input')?.value?.trim() || '';
      context.board_orientation = 'white';
    } else if (typeof studyGame !== 'undefined' && studyGame?.fen) {
      context.fen = studyGame.fen();
      context.pgn = studyGame.pgn?.() || '';
      context.move_number = Math.ceil((studyGame.history?.().length || 0) / 2);
      context.board_orientation = typeof studyOrientation !== 'undefined' ? studyOrientation : 'white';
    }
  } catch (error) {
    console.warn('Could not collect board context:', error);
  }
  return context;
}

async function uploadReportScreenshot(file) {
  if (!file) return null;
  if (!state.session?.user) throw new Error('Sign in before uploading a screenshot.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Screenshot must be 10 MB or smaller.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Screenshot must be PNG, JPG, or WebP.');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${state.session.user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await sb.storage.from(REPORT_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

function reportStatusLabel(status = '') {
  const labels = { open:'Submitted', under_review:'Under review', resolved:'Fixed', dismissed:'Closed' };
  return labels[status] || status.replaceAll('_',' ');
}


function openCommunityFeedback(mode = 'suggestion', opening = {}) {
  if (!state.session?.user) {
    toast('Sign in to send community feedback.');
    openAuth('signin');
    return;
  }
  const suggestion = mode === 'suggestion';
  $('community-feedback-mode').value = mode;
  $('community-feedback-opening-id').value = opening.id || '';
  $('community-feedback-opening-name').value = opening.name || (suggestion ? 'General opening suggestion' : 'BOZO website');
  $('community-feedback-pgn').value = opening.pgn || '';
  $('community-feedback-details').value = '';
  $('community-feedback-source').value = '';
  $('community-feedback-screenshot').value = '';
  $('community-feedback-severity').value = 'minor';
  $('community-feedback-board-context').checked = true;
  $('community-feedback-severity-label').hidden = suggestion;
  $('community-feedback-screenshot-label').hidden = suggestion;
  $('community-feedback-board-context-label').hidden = suggestion;
  $('community-feedback-auto-context').hidden = suggestion;
  if (!suggestion) {
    const auto = currentReportContext();
    $('community-feedback-auto-context').innerHTML = `<b>Automatically included</b><span>${escapeHtml(auto.route)} · ${escapeHtml(auto.viewport)} · ${auto.fen ? 'board position available' : 'page context only'}</span>`;
  }
  $('community-feedback-title').textContent = suggestion ? 'Suggest an improvement' : 'Report an issue';
  $('community-feedback-eyebrow').textContent = suggestion ? 'COMMUNITY OPENING REVIEW' : 'HELP US FIX IT';
  $('community-feedback-submit').textContent = suggestion ? 'Submit suggestion' : 'Submit report';
  $('community-feedback-pgn-label').hidden = !suggestion;
  $('community-feedback-source-label').hidden = !suggestion;
  $('community-feedback-opening-label').querySelector('span')?.remove();
  const types = suggestion ? SUGGESTION_TYPES : REPORT_TYPES;
  $('community-feedback-type').innerHTML = types.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
  $('community-feedback-details').placeholder = suggestion
    ? 'Explain what should change and why. Include analysis, move orders, or sources when useful.'
    : 'Tell us what happened, what you expected, and how we can reproduce the problem.';
  $('community-feedback-modal').hidden = false;
  setTimeout(() => $('community-feedback-type').focus(), 20);
}

function closeCommunityFeedback() {
  $('community-feedback-modal').hidden = true;
}

$('close-community-feedback').addEventListener('click', closeCommunityFeedback);
$('community-feedback-cancel').addEventListener('click', closeCommunityFeedback);
$('community-feedback-modal').addEventListener('click', event => {
  if (event.target.id === 'community-feedback-modal') closeCommunityFeedback();
});
$('footer-report-issue').addEventListener('click', () => openCommunityFeedback('report'));

document.addEventListener('click', event => {
  const suggestion = event.target.closest('.suggest-opening-button');
  if (suggestion) {
    openCommunityFeedback('suggestion', {
      id: suggestion.dataset.openingId,
      name: suggestion.dataset.openingName,
      pgn: suggestion.dataset.openingPgn
    });
    return;
  }
  const report = event.target.closest('.report-opening-button');
  if (report) {
    openCommunityFeedback('report', {
      id: report.dataset.openingId,
      name: report.dataset.openingName,
      pgn: report.dataset.openingPgn
    });
  }
});

$('community-feedback-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.session?.user) return openAuth('signin');
  const submit = $('community-feedback-submit');
  const mode = $('community-feedback-mode').value;
  const type = $('community-feedback-type').value;
  const openingId = $('community-feedback-opening-id').value || null;
  const openingName = $('community-feedback-opening-name').value.trim();
  const pgn = $('community-feedback-pgn').value.trim();
  const details = $('community-feedback-details').value.trim();
  const source = $('community-feedback-source').value.trim();
  const severity = $('community-feedback-severity').value || 'minor';
  const screenshotFile = $('community-feedback-screenshot').files?.[0] || null;
  if (!details) return toast('Please describe the suggestion or issue.');

  submit.disabled = true;
  submit.textContent = 'Sending…';
  let error;
  if (mode === 'suggestion') {
    const richPayload = {
      submitted_by: state.session.user.id,
      opening_id: openingId,
      proposed_name: openingName,
      proposed_pgn: pgn || null,
      submission_type: type,
      notes: [details, source ? `Source: ${source}` : ''].filter(Boolean).join('\n\n'),
      status: 'pending'
    };
    ({ error } = await sb.from('opening_submissions').insert(richPayload));
    if (error && /column|schema cache/i.test(readableError(error))) {
      ({ error } = await sb.from('opening_submissions').insert({
        submitted_by: state.session.user.id,
        proposed_name: openingName,
        submission_type: type,
        status: 'pending'
      }));
    }
  } else {
    let screenshotPath = null;
    try { screenshotPath = await uploadReportScreenshot(screenshotFile); }
    catch (uploadError) {
      submit.disabled = false;
      submit.textContent = 'Submit report';
      return toast(`Could not upload screenshot: ${readableError(uploadError)}`);
    }
    const auto = currentReportContext();
    const includeBoard = $('community-feedback-board-context').checked;
    const context = [openingName ? `Context: ${openingName}` : '', openingId ? `Opening ID: ${openingId}` : '', details].filter(Boolean).join('\n');
    const richPayload = {
      reported_by: state.session.user.id,
      reporter_id: state.session.user.id,
      report_type: type,
      severity,
      target_type: openingId ? 'opening' : 'website',
      target_id: openingId,
      opening_name: openingName || null,
      reason: details,
      details: context,
      page_url: auto.page_url,
      route: auto.route,
      browser_info: auto.user_agent,
      viewport: auto.viewport,
      screenshot_path: screenshotPath,
      fen: includeBoard ? (auto.fen || null) : null,
      pgn: includeBoard ? (auto.pgn || null) : null,
      move_number: includeBoard ? (auto.move_number || null) : null,
      board_orientation: includeBoard ? (auto.board_orientation || null) : null,
      status: 'open'
    };
    ({ error } = await sb.from('reports').insert(richPayload));
    if (error && /column|schema cache/i.test(readableError(error))) {
      ({ error } = await sb.from('reports').insert({
        reported_by: state.session.user.id,
        reporter_id: state.session.user.id,
        report_type: type,
        reason: context,
        status: 'open'
      }));
    }
  }
  submit.disabled = false;
  submit.textContent = mode === 'suggestion' ? 'Submit suggestion' : 'Submit report';
  if (error) return toast(`Could not send feedback: ${readableError(error)}`);
  closeCommunityFeedback();
  if (mode === 'suggestion') await logActivity('suggestion_submitted', { opening: openingName || '' });
  toast(mode === 'suggestion' ? 'Suggestion sent for review. Thank you!' : 'Report submitted. Thank you!');
});


function prepareContactPage() {
  const email = $('contact-email');
  const username = $('contact-username');
  if (email && !email.value && state.session?.user?.email) email.value = state.session.user.email;
  if (username && !username.value && state.profile?.username) username.value = state.profile.username;
}

$('contact-report-issue')?.addEventListener('click', () => openCommunityFeedback('report'));

$('contact-request-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = $('contact-submit');
  const status = $('contact-message-status');
  const success = $('contact-success');
  if (!submit) return;

  submit.disabled = true;
  submit.textContent = 'Submitting…';
  if (status) status.textContent = '';
  if (success) success.hidden = true;

  const payload = {
    p_email: ($('contact-email')?.value || '').trim(),
    p_username: ($('contact-username')?.value || '').trim().replace(/^@/, ''),
    p_category: $('contact-category')?.value || 'other',
    p_subject: ($('contact-subject')?.value || '').trim(),
    p_message: ($('contact-message')?.value || '').trim(),
    p_page_url: location.href,
    p_route: location.hash || '#contact',
    p_user_agent: navigator.userAgent,
    p_website: ($('contact-website')?.value || '').trim()
  };

  const { data, error } = await sb.rpc('bozo_submit_contact_request', payload);
  submit.disabled = false;
  submit.textContent = 'Submit request';

  if (error) {
    if (status) {
      status.textContent = readableError(error);
      status.classList.add('error');
    }
    return;
  }

  if (status) {
    status.textContent = '';
    status.classList.remove('error');
  }
  if (success) success.hidden = false;
  if ($('contact-case-number')) $('contact-case-number').textContent = `Reference: ${String(data || '').toUpperCase()}`;
  $('contact-subject').value = '';
  $('contact-message').value = '';
  $('contact-website').value = '';
});

function renderOwnerGate() {
  const allowed = Boolean(state.session && state.role === 'owner');
  $('owner-denied').hidden = allowed;
  $('owner-content').hidden = !allowed;
}


// WEB v4.12.0: Daily BOZO handcrafted puzzle system
const DAILY_TZ='America/Los_Angeles';
let dailySelectedDate=null, dailyPuzzle=null, dailyGame=null, dailyLine=[], dailyLineIndex=0, dailyHintsUsed=0, dailySolved=false, dailySelectedSquare=null, dailyArchiveMonth=null;
function dailyDateString(date=new Date()){ return new Intl.DateTimeFormat('en-CA',{timeZone:DAILY_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
function dailyToday(){ return dailyDateString(new Date()); }
function dailyShiftDate(iso,days){ const d=new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+days); return dailyDateString(d); }
function dailyPrettyDate(iso){ try{return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});}catch{return iso;} }
function dailyPieceMarkup(piece){ if(!piece)return ''; return webPiece((piece.color==='w'?piece.type.toUpperCase():piece.type.toLowerCase())); }
function dailySquareName(file,rank){return 'abcdefgh'[file]+(8-rank)}
function paintDailyBoard(){
  const board=$('daily-board'); if(!board||!dailyGame)return;
  const orientation=dailyPuzzle?.side_to_move==='b'?'black':'white';
  const ranks=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0], files=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  board.innerHTML=ranks.flatMap(r=>files.map(f=>{const sq=dailySquareName(f,r);const p=dailyGame.get(sq);return `<button type="button" class="board-square ${(r+f)%2?'dark':'light'}${dailySelectedSquare===sq?' selected':''}" data-daily-square="${sq}" aria-label="${sq}">${dailyPieceMarkup(p)}</button>`})).join('');
  board.querySelectorAll('[data-daily-square]').forEach(b=>b.addEventListener('click',()=>dailyBoardClick(b.dataset.dailySquare)));
}
function dailyBoardClick(sq){
  if(dailySolved||!dailyGame||!dailyPuzzle)return;
  const piece=dailyGame.get(sq);
  const turn=dailyGame.turn();
  if(!dailySelectedSquare){ if(piece&&piece.color===turn){dailySelectedSquare=sq;paintDailyBoard();} return; }
  if(piece&&piece.color===turn){dailySelectedSquare=sq;paintDailyBoard();return;}
  const from=dailySelectedSquare; dailySelectedSquare=null;
  const expected=(dailyLine[dailyLineIndex]||'').toLowerCase();
  let move=null; try{move=dailyGame.move({from,to:sq,promotion:'q'});}catch{}
  if(!move){paintDailyBoard();return;}
  const uci=(move.from+move.to+(move.promotion||'')).toLowerCase();
  if(uci!==expected){ dailyGame.undo(); paintDailyBoard(); const f=$('daily-feedback'); f.dataset.state='error'; f.innerHTML='<b>Not quite.</b><span>Try another continuation.</span>'; bozoCoachSetDialogue('Not quite. Look again at checks, captures, threats, and what changed on the last move.',{speak:true}); return; }
  dailyLineIndex++; paintDailyBoard(); paintDailyProgress();
  if(dailyLineIndex>=dailyLine.length){ finishDailyPuzzle(); return; }
  setTimeout(()=>{ if(dailySolved)return; const reply=(dailyLine[dailyLineIndex]||'').toLowerCase(); const legal=dailyGame.moves({verbose:true}); const found=legal.find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===reply); if(found){dailyGame.move(found);dailyLineIndex++;paintDailyBoard();paintDailyProgress(); if(dailyLineIndex>=dailyLine.length) finishDailyPuzzle();} },450);
}
function paintDailyProgress(){ const root=$('daily-line-progress'); if(!root)return; root.innerHTML=dailyLine.map((_,i)=>`<span class="${i<dailyLineIndex?'done':i===dailyLineIndex?'current':''}">${i+1}</span>`).join(''); }
async function loadDailyPuzzle(dateValue){
  dailySelectedDate=dateValue||dailySelectedDate||dailyToday(); dailyArchiveMonth=dailyArchiveMonth||dailySelectedDate.slice(0,7);
  $('daily-content').hidden=true; $('daily-missing').hidden=true;
  const {data,error}=await sb.rpc('get_daily_puzzle',{p_date:dailySelectedDate});
  if(error||!data||!(Array.isArray(data)?data[0]:data)){ $('daily-missing').hidden=false; $('daily-title').textContent='Daily BOZO'; $('daily-subtitle').textContent=dailyPrettyDate(dailySelectedDate); paintDailyArchive(); return; }
  dailyPuzzle=Array.isArray(data)?data[0]:data; dailyLine=Array.isArray(dailyPuzzle.main_line_uci)?dailyPuzzle.main_line_uci:(dailyPuzzle.main_line_uci||[]); dailyLineIndex=0; dailyHintsUsed=0; dailySolved=Boolean(dailyPuzzle.solved); dailySelectedSquare=null;
  try{dailyGame=new Chess(dailyPuzzle.fen);}catch{ $('daily-missing').hidden=false; return; }
  $('daily-title').textContent=dailyPuzzle.title||'Daily BOZO'; $('daily-subtitle').textContent=dailyPrettyDate(dailySelectedDate); $('daily-date-label').textContent=dailyPrettyDate(dailySelectedDate); $('daily-author-label').textContent=dailyPuzzle.author_name?`By ${dailyPuzzle.author_name}`:'BOZO Staff'; $('daily-theme-label').textContent=dailyPuzzle.theme||'Handcrafted'; $('daily-hints-left').textContent=Math.max(0,3-dailyHintsUsed); $('daily-content').hidden=false;
  paintDailyBoard(); paintDailyProgress(); await loadDailyStats(); await paintDailyArchive();
  if(dailySolved) unlockDailySolved(); else { $('daily-explanation-card').hidden=true; $('daily-discussion').hidden=true; $('daily-analyze').hidden=true; const f=$('daily-feedback'); f.dataset.state='neutral'; f.innerHTML='<b>Your move.</b><span>Find the authored continuation.</span>'; }
}
async function finishDailyPuzzle(){ dailySolved=true; const f=$('daily-feedback'); f.dataset.state='success'; f.innerHTML='<b>Solved!</b><span>You found the complete Daily BOZO continuation.</span>'; bozoCoachSetDialogue('Solved. Nice work. Now compare the solution with the explanation and focus on the idea you can reuse in another position.',{speak:true}); let mistakes=0; const {error}=await sb.rpc('record_daily_puzzle_solve',{p_puzzle_id:dailyPuzzle.id,p_hints_used:dailyHintsUsed,p_mistakes:mistakes,p_seconds:null}); if(error) console.warn('Daily solve sync failed',error); await loadDailyStats(); unlockDailySolved(); }
function dailyLineToSan(fen,line){
  try{
    const g=new Chess(fen), out=[];
    for(const u0 of (line||[])){
      const u=String(u0||'').toLowerCase();
      const move=g.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===u);
      if(!move) return (line||[]).join(' ');
      const n=g.move(move);
      if(n.color==='w') out.push(`${g.moveNumber?g.moveNumber-1:Math.ceil(out.length/2+1)}. ${n.san}`);
      else if(out.length && /^\d+\. /.test(out[out.length-1])) out[out.length-1]+=` ${n.san}`;
      else out.push(`... ${n.san}`);
    }
    return out.join('  ');
  }catch{return (line||[]).join(' ')}
}
function unlockDailySolved(){ $('daily-explanation-card').hidden=false; $('daily-discussion').hidden=false; $('daily-analyze').hidden=false; $('daily-explanation').textContent=dailyPuzzle.explanation||'Puzzle complete.'; $('daily-solution-line').textContent=(dailyPuzzle.main_line_san||dailyLineToSan(dailyPuzzle.fen,dailyLine)); loadDailyComments(); }
async function loadDailyStats(){ const {data}=await sb.rpc('get_daily_puzzle_stats'); const x=Array.isArray(data)?data[0]:data; if(x){$('daily-streak').textContent=x.current_streak||0;$('daily-solved-total').textContent=x.total_solved||0;} }
$('daily-prev')?.addEventListener('click',()=>loadDailyPuzzle(dailyShiftDate(dailySelectedDate||dailyToday(),-1)));
$('daily-next')?.addEventListener('click',()=>{const n=dailyShiftDate(dailySelectedDate||dailyToday(),1); if(n<=dailyToday())loadDailyPuzzle(n);});
$('daily-today')?.addEventListener('click',()=>loadDailyPuzzle(dailyToday()));
$('daily-reset')?.addEventListener('click',()=>loadDailyPuzzle(dailySelectedDate));
$('daily-hint')?.addEventListener('click',()=>{ if(!dailyPuzzle||dailySolved)return; const hints=[dailyPuzzle.hint1,dailyPuzzle.hint2,dailyPuzzle.hint3].filter(Boolean); if(dailyHintsUsed>=hints.length)return toast('No hints left.'); const text=hints[dailyHintsUsed++]; $('daily-hints-left').textContent=Math.max(0,3-dailyHintsUsed); const f=$('daily-feedback'); f.dataset.state='neutral'; f.innerHTML=`<b>Hint ${dailyHintsUsed}</b><span>${escapeHtml(text)}</span>`; bozoCoachSetDialogue(text,{speak:true}); });
$('daily-analyze')?.addEventListener('click',()=>{ if(!dailyPuzzle)return; route('review'); setTimeout(()=>{document.querySelector('[data-review-mode="position"]')?.click(); $('position-fen').value=dailyPuzzle.fen; try{positionLoadFen(dailyPuzzle.fen);}catch{} $('analyze-position')?.click();},120); });
$('daily-replay')?.addEventListener('click',()=>{dailySolved=false;dailyLineIndex=0;dailyGame=new Chess(dailyPuzzle.fen);paintDailyBoard();paintDailyProgress(); setTimeout(()=>replayDailyLine(),300);});
async function replayDailyLine(){ if(!dailyGame||dailyLineIndex>=dailyLine.length){dailySolved=true;paintDailyBoard();return;} const u=dailyLine[dailyLineIndex]; const found=dailyGame.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===String(u).toLowerCase()); if(found){dailyGame.move(found);dailyLineIndex++;paintDailyBoard();paintDailyProgress();setTimeout(replayDailyLine,600);} }
async function paintDailyArchive(){ const month=dailyArchiveMonth||dailyToday().slice(0,7); $('daily-archive-month').textContent=new Date(month+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}); const {data}=await sb.rpc('list_daily_puzzles',{p_month:month+'-01'}); const rows=data||[], map=new Map(rows.map(r=>[r.puzzle_date,r])); const [y,m]=month.split('-').map(Number), days=new Date(y,m,0).getDate(), first=new Date(y,m-1,1).getDay(); let html=''; for(let i=0;i<first;i++)html+='<span class="blank"></span>'; for(let d=1;d<=days;d++){const iso=`${month}-${String(d).padStart(2,'0')}`,r=map.get(iso), future=iso>dailyToday(); html+=`<button type="button" data-daily-date="${iso}" class="${iso===dailySelectedDate?'active ':''}${r?.solved?'solved ':''}" ${(!r||future)?'disabled':''}>${d}${r?.solved?'✓':''}</button>`;} $('daily-calendar').innerHTML=html; $('daily-calendar').querySelectorAll('[data-daily-date]').forEach(b=>b.addEventListener('click',()=>loadDailyPuzzle(b.dataset.dailyDate))); }
$('daily-month-prev')?.addEventListener('click',()=>{const d=new Date((dailyArchiveMonth||dailyToday().slice(0,7))+'-15T12:00:00');d.setMonth(d.getMonth()-1);dailyArchiveMonth=dailyDateString(d).slice(0,7);paintDailyArchive();});
$('daily-month-next')?.addEventListener('click',()=>{const d=new Date((dailyArchiveMonth||dailyToday().slice(0,7))+'-15T12:00:00');d.setMonth(d.getMonth()+1);dailyArchiveMonth=dailyDateString(d).slice(0,7);paintDailyArchive();});
async function loadDailyComments(){ if(!dailyPuzzle)return; const {data,error}=await sb.rpc('list_daily_puzzle_comments',{p_puzzle_id:dailyPuzzle.id}); if(error)return; const rows=data||[]; $('daily-comment-count').textContent=`${rows.length} comment${rows.length===1?'':'s'}`; const byParent=new Map(); rows.forEach(r=>{const k=r.parent_id||'root';if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(r)}); const render=(r,depth=0)=>`<article class="daily-comment" style="--depth:${Math.min(depth,3)}"><div><b>${escapeHtml(r.ign||r.username||'BOZO player')}</b><small>@${escapeHtml(r.username||'player')} · ${new Date(r.created_at).toLocaleString()}</small></div><p>${escapeHtml(r.body)}</p><div class="daily-comment-actions"><button data-daily-reply="${r.id}" type="button">Reply</button><button data-daily-like="${r.id}" type="button">♡ ${Number(r.like_count||0)}</button><button data-daily-report="${r.id}" type="button">Report</button></div>${(byParent.get(r.id)||[]).map(x=>render(x,depth+1)).join('')}</article>`; $('daily-comments').innerHTML=(byParent.get('root')||[]).map(r=>render(r)).join('')||'<div class="empty-state mini"><span>Be the first to discuss this puzzle.</span></div>'; bindDailyCommentActions(); }
$('daily-comment-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!state.session)return openAuth('signin');const body=$('daily-comment-input').value.trim();if(!body)return;const {error}=await sb.rpc('post_daily_puzzle_comment',{p_puzzle_id:dailyPuzzle.id,p_body:body,p_parent_id:null});if(error)return toast(readableError(error));$('daily-comment-input').value='';loadDailyComments();});
function bindDailyCommentActions(){ $('daily-comments').querySelectorAll('[data-daily-reply]').forEach(b=>b.addEventListener('click',async()=>{if(!state.session)return openAuth('signin');const body=prompt('Reply:');if(!body)return;const {error}=await sb.rpc('post_daily_puzzle_comment',{p_puzzle_id:dailyPuzzle.id,p_body:body,p_parent_id:b.dataset.dailyReply});if(error)return toast(readableError(error));loadDailyComments();})); $('daily-comments').querySelectorAll('[data-daily-like]').forEach(b=>b.addEventListener('click',async()=>{if(!state.session)return openAuth('signin');await sb.rpc('toggle_daily_comment_like',{p_comment_id:b.dataset.dailyLike});loadDailyComments();})); $('daily-comments').querySelectorAll('[data-daily-report]').forEach(b=>b.addEventListener('click',async()=>{if(!state.session)return openAuth('signin');const reason=prompt('What is wrong with this comment?');if(!reason)return;const {error}=await sb.rpc('report_daily_comment',{p_comment_id:b.dataset.dailyReport,p_reason:reason});if(error)return toast(readableError(error));toast('Comment reported.');})); }

// Daily Puzzle Studio
let dailyEditorGame=null,dailyEditorMoves=[],dailyEditorSelected=null,dailyStudioMonth=dailyToday().slice(0,7),dailyStudioSelectedDate=dailyToday();
let dailyEditorSetupMode=false,dailySetupPieces={},dailySetupTool='wP',dailyEditorOrientation='white';
function dailyStudioMarkup(){ return `<div class="panel-heading"><div><span>DAILY PUZZLE STUDIO</span><h2>Author & schedule Daily BOZO</h2></div><button id="daily-studio-new" class="button secondary small" type="button">New puzzle</button></div>
<p class="owner-helper">California rollover: midnight America/Los_Angeles. Build a position, physically play the authored continuation, preview it, then schedule it for any day.</p>
<div class="daily-studio-grid"><section class="daily-editor-form"><div class="daily-editor-row"><label>Date<input id="daily-editor-date" type="date"></label><label>Status<select id="daily-editor-status"><option value="draft">Draft</option><option value="ready">Ready</option><option value="scheduled">Scheduled</option></select></label></div><label>Title<input id="daily-editor-title" maxlength="80" placeholder="The Quiet Move"></label><label>Theme<input id="daily-editor-theme" maxlength="60" placeholder="Deflection, defense, positional continuation…"></label><label>Starting FEN<textarea id="daily-editor-fen" rows="3" spellcheck="false"></textarea></label><div class="daily-editor-actions"><button id="daily-editor-load-fen" class="button secondary" type="button">Load FEN</button><button id="daily-editor-startpos" class="button secondary" type="button">Starting position</button><button id="daily-editor-setup" class="button secondary" type="button">Set up position</button></div>
<div id="daily-setup-panel" class="daily-setup-panel" hidden><div class="daily-setup-heading"><b>Position setup</b><span>Pick a piece, then click squares to place it. Choose Eraser to remove pieces.</span></div><div id="daily-setup-palette" class="daily-setup-palette"></div><div class="daily-setup-options"><label>Side to move<select id="daily-setup-turn"><option value="w">White</option><option value="b">Black</option></select></label><fieldset><legend>Castling rights</legend><label><input id="daily-castle-wk" type="checkbox"> White O-O</label><label><input id="daily-castle-wq" type="checkbox"> White O-O-O</label><label><input id="daily-castle-bk" type="checkbox"> Black O-O</label><label><input id="daily-castle-bq" type="checkbox"> Black O-O-O</label></fieldset><label>En passant square<input id="daily-setup-ep" maxlength="2" placeholder="-"></label></div><div class="daily-editor-actions"><button id="daily-setup-clear" class="button secondary" type="button">Clear board</button><button id="daily-setup-done" class="button primary" type="button">Done setting up</button><button id="daily-setup-cancel" class="button secondary" type="button">Cancel</button></div></div>
<div id="daily-editor-board" class="web-duel-board daily-editor-board"></div><div class="daily-editor-actions"><button id="daily-editor-flip" class="button secondary" type="button">Flip board</button><button id="daily-editor-undo" class="button secondary" type="button">Undo move</button><button id="daily-editor-reset-line" class="button secondary" type="button">Reset line</button></div><label>Recorded continuation<textarea id="daily-editor-line" rows="3" readonly></textarea></label><label>Accepted alternate lines (optional)<textarea id="daily-editor-alternates" rows="3" placeholder="One UCI line per row, e.g. e2e4 e7e5 g1f3"></textarea></label><label>Hint 1<input id="daily-editor-hint1" maxlength="160"></label><label>Hint 2<input id="daily-editor-hint2" maxlength="160"></label><label>Hint 3<input id="daily-editor-hint3" maxlength="160"></label><label>Explanation<textarea id="daily-editor-explanation" rows="5" maxlength="1600"></textarea></label><div class="daily-editor-actions"><button id="daily-editor-preview" class="button secondary" type="button">Preview</button><button id="daily-editor-save" class="button primary" type="button">Save puzzle</button></div><div id="daily-editor-message" class="auth-message"></div></section><aside><section class="daily-studio-calendar-card"><div class="panel-heading"><div><span>SCHEDULE</span><h3 id="daily-studio-month-label"></h3></div></div><div class="daily-archive-controls"><button id="daily-studio-prev">←</button><button id="daily-studio-next">→</button></div><div id="daily-studio-calendar" class="daily-calendar studio"></div></section><section class="daily-editor-permissions"><span class="eyebrow">PUZZLE EDITORS</span><p>Owner can authorize staff without giving them Owner access.</p><div class="inline-form"><input id="daily-editor-staff-username" placeholder="@username"><button id="daily-editor-add-staff" class="button secondary small" type="button">Grant editor</button></div></section></aside></div>`; }
async function initDailyStudio(){ resetDailyEditor(dailyStudioSelectedDate); bindDailyStudio(); await paintDailyStudioCalendar(); }
function dailyEditorClearFields(){
  for(const id of ['daily-editor-title','daily-editor-theme','daily-editor-hint1','daily-editor-hint2','daily-editor-hint3','daily-editor-explanation','daily-editor-alternates']) if($(id)) $(id).value='';
  if($('daily-editor-status')) $('daily-editor-status').value='draft'; if($('daily-editor-message')) $('daily-editor-message').textContent='';
}
function resetDailyEditor(date=dailyToday()){
  dailyStudioSelectedDate=date; dailyEditorMoves=[]; dailyEditorSelected=null; dailyEditorSetupMode=false; dailySetupPieces={};
  try{dailyEditorGame=new Chess();}catch{}
  dailyEditorClearFields();
  if($('daily-editor-date'))$('daily-editor-date').value=date;
  if($('daily-editor-fen')&&dailyEditorGame)$('daily-editor-fen').value=dailyEditorGame.fen();
  $('daily-setup-panel')?.setAttribute('hidden','');
  paintDailyEditorBoard();paintDailyEditorLine();
}
function dailyEditorPieceAt(sq){ return dailyEditorSetupMode ? (dailySetupPieces[sq]||null) : dailyEditorGame?.get(sq); }
function paintDailyEditorBoard(){
  const board=$('daily-editor-board');if(!board||(!dailyEditorGame&&!dailyEditorSetupMode))return;
  board.classList.toggle('setup-mode',dailyEditorSetupMode);
  board.dataset.orientation=dailyEditorOrientation;
  const ranks=dailyEditorOrientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  const files=dailyEditorOrientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  board.innerHTML=ranks.flatMap(r=>files.map(f=>{const sq=dailySquareName(f,r),p=dailyEditorPieceAt(sq);return `<button type="button" class="board-square ${(r+f)%2?'dark':'light'}${dailyEditorSelected===sq?' selected':''}" data-daily-editor-square="${sq}" aria-label="${sq}">${dailyPieceMarkup(p)}</button>`})).join('');
  decorateBozoBoardCoordinates(board);
  board.querySelectorAll('[data-daily-editor-square]').forEach(b=>{b.addEventListener('click',()=>dailyEditorClick(b.dataset.dailyEditorSquare));b.addEventListener('contextmenu',e=>{if(!dailyEditorSetupMode)return;e.preventDefault();delete dailySetupPieces[b.dataset.dailyEditorSquare];paintDailyEditorBoard();});});
}
function dailyEditorClick(sq){
  if(dailyEditorSetupMode){
    if(dailySetupTool==='erase'){ delete dailySetupPieces[sq]; }
    else {
      const m=/^([wb])([KQRBNP])$/.exec(String(dailySetupTool||''));
      if(!m)return;
      dailySetupPieces[sq]={color:m[1],type:m[2].toLowerCase()};
    }
    paintDailyEditorBoard();
    return;
  }
  if(!dailyEditorGame)return;
  const p=dailyEditorGame.get(sq);
  if(!dailyEditorSelected){
    if(p&&p.color===dailyEditorGame.turn()){ dailyEditorSelected=sq; paintDailyEditorBoard(); }
    return;
  }
  if(p&&p.color===dailyEditorGame.turn()){ dailyEditorSelected=sq; paintDailyEditorBoard(); return; }
  const from=dailyEditorSelected; dailyEditorSelected=null; let move=null;
  try{ move=dailyEditorGame.move({from,to:sq,promotion:'q'}); }catch{}
  if(move){ dailyEditorMoves.push(move.from+move.to+(move.promotion||'')); paintDailyEditorLine(); }
  paintDailyEditorBoard();
}
function paintDailyEditorLine(){if($('daily-editor-line'))$('daily-editor-line').value=dailyEditorMoves.join(' ');}
function dailySetupFromGame(){
  dailySetupPieces={}; if(!dailyEditorGame)return;
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){const sq=dailySquareName(f,r),p=dailyEditorGame.get(sq);if(p)dailySetupPieces[sq]={color:p.color,type:p.type};}
  const fen=($('daily-editor-fen')?.value||dailyEditorGame.fen()).trim().split(/\s+/); const turn=fen[1]||'w',castle=fen[2]||'-',ep=fen[3]||'-';
  if($('daily-setup-turn'))$('daily-setup-turn').value=turn; if($('daily-setup-ep'))$('daily-setup-ep').value=ep==='-'?'':ep;
  if($('daily-castle-wk'))$('daily-castle-wk').checked=castle.includes('K'); if($('daily-castle-wq'))$('daily-castle-wq').checked=castle.includes('Q'); if($('daily-castle-bk'))$('daily-castle-bk').checked=castle.includes('k'); if($('daily-castle-bq'))$('daily-castle-bq').checked=castle.includes('q');
}
function dailySetupFen(){
  const rows=[]; for(let rank=8;rank>=1;rank--){let row='',empty=0;for(const file of 'abcdefgh'){const p=dailySetupPieces[file+rank];if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}let ch=p.type; if(p.color==='w')ch=ch.toUpperCase(); row+=ch;}if(empty)row+=empty;rows.push(row)}
  let castle=''; if($('daily-castle-wk')?.checked)castle+='K';if($('daily-castle-wq')?.checked)castle+='Q';if($('daily-castle-bk')?.checked)castle+='k';if($('daily-castle-bq')?.checked)castle+='q'; if(!castle)castle='-';
  const turn=$('daily-setup-turn')?.value||'w', ep=($('daily-setup-ep')?.value||'').trim().toLowerCase()||'-'; return `${rows.join('/')} ${turn} ${castle} ${ep} 0 1`;
}
function paintDailySetupPalette(){const root=$('daily-setup-palette');if(!root)return;const tools=[['wK','White king'],['wQ','White queen'],['wR','White rook'],['wB','White bishop'],['wN','White knight'],['wP','White pawn'],['bK','Black king'],['bQ','Black queen'],['bR','Black rook'],['bB','Black bishop'],['bN','Black knight'],['bP','Black pawn'],['erase','Eraser']];root.innerHTML=tools.map(([v,label])=>{const p=v==='erase'?null:{color:v[0],type:v[1].toLowerCase()};return `<button type="button" class="daily-palette-piece${dailySetupTool===v?' active':''}" data-setup-tool="${v}" title="${label}">${v==='erase'?'⌫':dailyPieceMarkup(p)}<small>${label}</small></button>`}).join('');root.querySelectorAll('[data-setup-tool]').forEach(b=>b.addEventListener('click',()=>{dailySetupTool=b.dataset.setupTool;paintDailySetupPalette()}));}
function enterDailySetup(){dailyEditorSetupMode=true;dailyEditorSelected=null;dailySetupFromGame();$('daily-setup-panel').hidden=false;paintDailySetupPalette();paintDailyEditorBoard();}
function finishDailySetup(){
  const wk=Object.values(dailySetupPieces).filter(p=>p.color==='w'&&p.type==='k').length,bk=Object.values(dailySetupPieces).filter(p=>p.color==='b'&&p.type==='k').length;
  if(wk!==1||bk!==1){$('daily-editor-message').textContent='Position setup needs exactly one white king and one black king.';return;}
  const fen=dailySetupFen(); try{dailyEditorGame=new Chess(fen);}catch(e){$('daily-editor-message').textContent='That setup is not a legal FEN. Check kings, side to move, castling, and en passant.';return;}
  $('daily-editor-fen').value=fen;dailyEditorMoves=[];dailyEditorSelected=null;dailyEditorSetupMode=false;$('daily-setup-panel').hidden=true;paintDailyEditorBoard();paintDailyEditorLine();$('daily-editor-message').textContent='Position loaded. Play the solution on the board to record the continuation.';
}
function bindDailyStudio(){
  $('daily-editor-flip')?.addEventListener('click',()=>{dailyEditorOrientation=dailyEditorOrientation==='white'?'black':'white';paintDailyEditorBoard();});
  $('daily-studio-new')?.addEventListener('click',()=>resetDailyEditor($('daily-editor-date')?.value||dailyStudioSelectedDate||dailyToday()));
  $('daily-editor-load-fen')?.addEventListener('click',()=>{try{dailyEditorGame=new Chess($('daily-editor-fen').value.trim());dailyEditorMoves=[];dailyEditorSetupMode=false;$('daily-setup-panel').hidden=true;paintDailyEditorBoard();paintDailyEditorLine();$('daily-editor-message').textContent='FEN loaded.';}catch{$('daily-editor-message').textContent='Invalid FEN.'}});
  $('daily-editor-startpos')?.addEventListener('click',()=>{try{dailyEditorGame=new Chess();$('daily-editor-fen').value=dailyEditorGame.fen();dailyEditorMoves=[];dailyEditorSetupMode=false;$('daily-setup-panel').hidden=true;paintDailyEditorBoard();paintDailyEditorLine();}catch{}});
  $('daily-editor-setup')?.addEventListener('click',enterDailySetup); $('daily-setup-clear')?.addEventListener('click',()=>{dailySetupPieces={};paintDailyEditorBoard();}); $('daily-setup-done')?.addEventListener('click',finishDailySetup); $('daily-setup-cancel')?.addEventListener('click',()=>{dailyEditorSetupMode=false;$('daily-setup-panel').hidden=true;paintDailyEditorBoard();});
  $('daily-editor-undo')?.addEventListener('click',()=>{if(dailyEditorSetupMode)return;dailyEditorGame.undo();dailyEditorMoves.pop();paintDailyEditorBoard();paintDailyEditorLine();});
  $('daily-editor-reset-line')?.addEventListener('click',()=>{try{dailyEditorGame=new Chess($('daily-editor-fen').value.trim());dailyEditorMoves=[];dailyEditorSelected=null;dailyEditorSetupMode=false;$('daily-setup-panel').hidden=true;paintDailyEditorBoard();paintDailyEditorLine();}catch{}});
  $('daily-editor-save')?.addEventListener('click',saveDailyEditorPuzzle); $('daily-editor-preview')?.addEventListener('click',async()=>{const d=$('daily-editor-date').value;if(!d)return;if(await saveDailyEditorPuzzle(true)){route('daily');setTimeout(()=>loadDailyPuzzle(d),80);}}); $('daily-studio-prev')?.addEventListener('click',()=>shiftDailyStudioMonth(-1));$('daily-studio-next')?.addEventListener('click',()=>shiftDailyStudioMonth(1)); $('daily-editor-add-staff')?.addEventListener('click',grantDailyEditor);
  $('daily-editor-date')?.addEventListener('change',()=>{dailyStudioSelectedDate=$('daily-editor-date').value||dailyToday();dailyStudioMonth=dailyStudioSelectedDate.slice(0,7);paintDailyStudioCalendar();});
}
async function saveDailyEditorPuzzle(preview=false){
  if(dailyEditorSetupMode)return $('daily-editor-message').textContent='Finish position setup before saving.';
  try{new Chess($('daily-editor-fen').value.trim())}catch{return $('daily-editor-message').textContent='Starting FEN is invalid.';}
  const alt=$('daily-editor-alternates').value.split(/\n+/).map(x=>x.trim().split(/\s+/).filter(Boolean)).filter(x=>x.length); const payload={p_puzzle_date:$('daily-editor-date').value,p_title:$('daily-editor-title').value.trim()||'Daily BOZO',p_fen:$('daily-editor-fen').value.trim(),p_theme:$('daily-editor-theme').value.trim(),p_main_line_uci:dailyEditorMoves,p_accepted_lines:alt,p_hint1:$('daily-editor-hint1').value.trim(),p_hint2:$('daily-editor-hint2').value.trim(),p_hint3:$('daily-editor-hint3').value.trim(),p_explanation:$('daily-editor-explanation').value.trim(),p_status:preview?'scheduled':$('daily-editor-status').value}; const {error}=await sb.rpc('save_daily_puzzle',payload); if(error){$('daily-editor-message').textContent=readableError(error);return false;} dailyStudioSelectedDate=payload.p_puzzle_date;$('daily-editor-message').textContent=preview?'Saved for preview.':'Daily puzzle saved.';await paintDailyStudioCalendar();return true;
}
async function paintDailyStudioCalendar(){ if(!$('daily-studio-calendar'))return; $('daily-studio-month-label').textContent=new Date(dailyStudioMonth+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}); const {data}=await sb.rpc('list_daily_puzzles_editor',{p_month:dailyStudioMonth+'-01'});const rows=data||[],map=new Map(rows.map(r=>[r.puzzle_date,r]));const [y,m]=dailyStudioMonth.split('-').map(Number),days=new Date(y,m,0).getDate(),first=new Date(y,m-1,1).getDay();let html='';for(let i=0;i<first;i++)html+='<span class="blank"></span>';for(let d=1;d<=days;d++){const iso=`${dailyStudioMonth}-${String(d).padStart(2,'0')}`,r=map.get(iso),active=iso===dailyStudioSelectedDate;html+=`<button type="button" data-studio-date="${iso}" class="${r?'filled '+r.status:'missing'}${active?' active':''}" title="${r?escapeHtml(r.title||'Scheduled puzzle'):'Empty day: click to create'}">${d}<small>${r?r.status:'＋'}</small></button>`}$('daily-studio-calendar').innerHTML=html;$('daily-studio-calendar').querySelectorAll('[data-studio-date]').forEach(b=>b.addEventListener('click',()=>loadDailyStudioDate(b.dataset.studioDate))); }
function shiftDailyStudioMonth(delta){const d=new Date(dailyStudioMonth+'-15T12:00:00');d.setMonth(d.getMonth()+delta);dailyStudioMonth=dailyDateString(d).slice(0,7);paintDailyStudioCalendar();}
async function loadDailyStudioDate(date){
  dailyStudioSelectedDate=date; dailyStudioMonth=date.slice(0,7); const msg=$('daily-editor-message'); if(msg)msg.textContent='Loading puzzle…';
  const {data,error}=await sb.rpc('get_daily_puzzle_editor',{p_date:date}); if(error){if(msg)msg.textContent=readableError(error);return;} const r=Array.isArray(data)?data[0]:data;
  dailyEditorMoves=[];dailyEditorSelected=null;dailyEditorSetupMode=false;dailySetupPieces={};dailyEditorClearFields();$('daily-setup-panel').hidden=true;$('daily-editor-date').value=date;
  if(!r){try{dailyEditorGame=new Chess();$('daily-editor-fen').value=dailyEditorGame.fen();}catch{}paintDailyEditorBoard();paintDailyEditorLine();if(msg)msg.textContent=`${dailyPrettyDate(date)} is empty. Create a new puzzle for this day.`;paintDailyStudioCalendar();return;}
  $('daily-editor-title').value=r.title||'';$('daily-editor-theme').value=r.theme||'';$('daily-editor-fen').value=r.fen||'';dailyEditorOrientation=(String(r.fen||'').split(/\s+/)[1]==='b'?'black':'white');$('daily-editor-status').value=r.status||'draft';$('daily-editor-hint1').value=r.hint1||'';$('daily-editor-hint2').value=r.hint2||'';$('daily-editor-hint3').value=r.hint3||'';$('daily-editor-explanation').value=r.explanation||'';$('daily-editor-alternates').value=(r.accepted_lines||[]).map(x=>x.join(' ')).join('\n');dailyEditorMoves=Array.isArray(r.main_line_uci)?[...r.main_line_uci]:[];
  try{dailyEditorGame=new Chess(r.fen);for(const u of dailyEditorMoves){const m=dailyEditorGame.moves({verbose:true}).find(x=>(x.from+x.to+(x.promotion||''))===u);if(!m)break;dailyEditorGame.move(m)}}catch{try{dailyEditorGame=new Chess(r.fen)}catch{dailyEditorGame=new Chess()}}
  paintDailyEditorBoard();paintDailyEditorLine();if(msg)msg.textContent=`Loaded ${r.title||'Daily BOZO'} for ${dailyPrettyDate(date)}.`;paintDailyStudioCalendar();
}
async function grantDailyEditor(){if(state.role!=='owner')return toast('Only the Owner can grant puzzle editor access.');const username=$('daily-editor-staff-username').value.trim().replace(/^@/,'');if(!username)return;const {error}=await sb.rpc('owner_set_daily_puzzle_editor',{p_username:username,p_enabled:true});if(error)return toast(readableError(error));toast(`@${username} can now edit Daily BOZO puzzles.`);$('daily-editor-staff-username').value='';}

$$('[data-owner-panel]').forEach(button => {
  button.addEventListener('click', () => loadOwnerPanel(button.dataset.ownerPanel));
});

async function loadOwnerPanel(panel) {
  if (panel === 'endgames') { await ownerEndgameManager(); return; }
  const target = $('owner-panel');
  target.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading…</b></div>';

  if (panel === 'analytics') {
    const { data, error } = await sb.rpc('owner_platform_analytics');
    if (error) return ownerError(error);
    const s = data || {};
    target.innerHTML = `<div class="panel-heading"><div><span>LIVE DATA</span><h2>Platform analytics</h2></div></div>
      <div class="analytics-grid">
        ${analyticsStat(s.total_users,'Total users')}
        ${analyticsStat(s.confirmed_users,'Confirmed')}
        ${analyticsStat(s.active_7d,'Active in 7 days')}
        ${analyticsStat(s.total_xp,'Total XP')}
        ${analyticsStat(s.total_lines,'Lines drilled')}
        ${analyticsStat(s.total_games,'Games analyzed')}
        ${analyticsStat(s.pending_submissions,'Pending theory')}
        ${analyticsStat(s.open_reports,'Open reports')}
      </div>`;
    return;
  }

  if (panel === 'users') {
    target.innerHTML = `<div class="panel-heading"><div><span>USERS</span><h2>Search accounts</h2></div></div>
      <div class="user-search-form"><input id="owner-user-search" placeholder="Search IGN or username"><button id="owner-user-search-button" class="button primary">Search</button></div>
      <div id="owner-user-results" class="owner-list"></div>`;
    $('owner-user-search-button').addEventListener('click', ownerSearchUsers);
    return;
  }


  if (panel === 'openingelo') {
    if (state.role !== 'owner') return ownerError({message:'Owner access required.'});
    target.innerHTML = ownerOpeningEloMarkup();
    $('owner-opening-elo-search-button').addEventListener('click',()=>ownerLoadOpeningElo($('owner-opening-elo-search').value.trim()));
    $('owner-opening-elo-search').addEventListener('keydown',e=>{if(e.key==='Enter')ownerLoadOpeningElo(e.currentTarget.value.trim());});
    await ownerLoadOpeningElo('');
    return;
  }

  if (panel === 'community') {
    const { data, error } = await sb.rpc('staff_list_community_objects');
    if (error) return ownerError(error);
    const rows = data || [];
    target.innerHTML = `<div class="panel-heading"><div><span>COMMUNITY</span><h2>Clubs & arenas</h2></div></div>
      <p class="profile-repertoire-help">Review community-created clubs and arenas. Cancelling or removing content is recorded in the admin audit log.</p>
      <div class="owner-list">${rows.map(r => `<div class="user-card community-owner-card">
        <div class="user-card-head"><div><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.object_type.toUpperCase())} · @${escapeHtml(r.owner_username || 'system')}</span></div><span class="role-badge">${escapeHtml(r.status || r.visibility || '')}</span></div>
        <p>${escapeHtml(r.description || r.details || '')}</p>
        <div class="owner-supporter-actions">
          ${r.object_type === 'arena' && r.status !== 'cancelled' ? `<button class="button ghost small" data-community-action="cancel" data-community-type="arena" data-community-id="${r.id}">Cancel arena</button>` : ''}
          ${r.object_type === 'club' ? `<button class="button ghost small" data-community-action="remove" data-community-type="club" data-community-id="${r.id}">Remove club</button>` : ''}
        </div>
      </div>`).join('') || '<div class="empty-state"><div>✓</div><b>No community objects found</b></div>'}</div>`;

    target.querySelectorAll('[data-community-action]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm(`${button.dataset.communityAction === 'remove' ? 'Remove' : 'Cancel'} this ${button.dataset.communityType}?`)) return;
      const { error } = await sb.rpc('staff_moderate_community_object', {
        object_type_value:button.dataset.communityType,
        object_id_value:button.dataset.communityId,
        action_value:button.dataset.communityAction
      });
      if (error) return toast(readableError(error));
      toast('Community moderation action applied.');
      loadOwnerPanel('community');
    }));
    return;
  }

  if (panel === 'daily') {
    const { data: allowed, error: accessError } = await sb.rpc('can_edit_daily_puzzles');
    if (accessError || !allowed) return ownerError(accessError || {message:'Daily Puzzle editor access required.'});
    target.innerHTML = dailyStudioMarkup();
    await initDailyStudio();
    return;
  }

  if (panel === 'mastergames') {
    if (state.role !== 'owner') return ownerError({message:'Owner access required.'});
    target.innerHTML = `<div class="panel-heading"><div><span>MASTER DATABASE</span><h2>Import master games</h2></div></div>
      <p class="profile-repertoire-help">Paste one or many PGNs. BOZO strips commentary/variations, keeps the factual game record, generates every FEN itself, and upserts a deduplicated game into the Master Database.</p>
      <div class="master-import-grid">
        <div><label>PGN games<textarea id="master-import-pgn" placeholder="[Event &quot;...&quot;]\n[White &quot;...&quot;]\n[Black &quot;...&quot;]\n\n1. e4 e5 2. Nf3 ..."></textarea></label>
        <div class="owner-supporter-actions"><button id="master-import-run" class="button primary" type="button">Import PGN</button><button id="master-import-clear" class="button secondary" type="button">Clear</button></div><pre id="master-import-status" class="master-import-status"></pre></div>
        <aside class="master-import-help"><span class="eyebrow">IMPORT RULES</span><h3>BOZO builds its own training data.</h3><p>Only the game record is imported. Comments, annotations, engine symbols, and side variations are discarded.</p><label>Source label<input id="master-import-source" value="Public PGN" maxlength="120"></label><p><b>Deduplication:</b> player names + date + normalized move sequence.</p><p><b>Generated by BOZO:</b> UCI moves, FEN after every ply, searchable position keys, and training decisions.</p></aside>
      </div>`;
    $('master-import-run').addEventListener('click', importMasterPgnFromOwner);
    $('master-import-clear').addEventListener('click',()=>{$('master-import-pgn').value='';$('master-import-status').textContent='';});
    return;
  }

  if (panel === 'verification') {
    const { data, error } = await sb.rpc('owner_list_verification_requests');
    if (error) return ownerError(error);
    target.innerHTML = `<div class="panel-heading"><div><span>TRUST & TITLES</span><h2>Verification queue</h2></div></div>
      <p class="profile-repertoire-help">Approve official chess titles only after checking the evidence. BM is an honorary BOZO title and can be granted from User Search.</p>
      <div class="owner-list">${(data||[]).map(r=>`<div class="user-card"><div class="user-card-head"><div><b>${escapeHtml(r.ign||'Player')}</b><span>@${escapeHtml(r.username||'')}</span></div><span class="profile-title-chip">${escapeHtml(r.requested_title)}</span></div><p>${escapeHtml(r.evidence_text||'')}</p><div class="owner-supporter-actions"><button class="button primary small" data-vapprove="${r.id}">Approve</button><button class="button ghost small" data-vreject="${r.id}">Reject</button></div></div>`).join('') || '<div class="empty-state"><div>✓</div><b>No pending verification requests</b></div>'}</div>`;
    target.querySelectorAll('[data-vapprove]').forEach(b=>b.addEventListener('click',async()=>{ const {error}=await sb.rpc('owner_review_title_request',{request_id:b.dataset.vapprove,approve:true}); if(error)return toast(readableError(error)); toast('Title verified.'); loadOwnerPanel('verification'); }));
    target.querySelectorAll('[data-vreject]').forEach(b=>b.addEventListener('click',async()=>{ const {error}=await sb.rpc('owner_review_title_request',{request_id:b.dataset.vreject,approve:false}); if(error)return toast(readableError(error)); toast('Request rejected.'); loadOwnerPanel('verification'); }));
    return;
  }


  if (panel === 'contact') {
    const { data, error } = await sb.from('bozo_contact_requests').select('*').order('created_at',{ascending:false}).limit(100);
    if (error) return ownerError(error);
    const rows = data || [];
    const openCount = rows.filter(x => ['open','in_review','waiting_user'].includes(x.status)).length;
    const privacyCount = rows.filter(x => x.category === 'privacy' && !['resolved','closed'].includes(x.status)).length;
    const disputeCount = rows.filter(x => ['moderation','fair_play','billing','legal'].includes(x.category) && !['resolved','closed'].includes(x.status)).length;
    target.innerHTML = `
      <div class="panel-heading">
        <div><span>OWNER INBOX</span><h2>Help & Contact</h2></div>
      </div>
      <div class="analytics-grid" style="margin-bottom:16px">
        ${analyticsStat(rows.length,'Recent requests')}
        ${analyticsStat(openCount,'Needs attention')}
        ${analyticsStat(privacyCount,'Open privacy')}
        ${analyticsStat(disputeCount,'Open disputes')}
      </div>
      <div class="owner-contact-list">
        ${rows.map(ownerContactMarkup).join('') || '<div class="empty-state"><div>✓</div><b>No contact requests yet</b><span>Account, dispute, privacy, billing, and legal requests will appear here.</span></div>'}
      </div>`;

    target.querySelectorAll('[data-contact-status]').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.contactId;
        const status = button.dataset.contactStatus;
        const card = button.closest('[data-contact-card]');
        const notes = card?.querySelector('[data-contact-notes]')?.value || '';
        const patch = { status, owner_notes: notes || null, updated_at: new Date().toISOString() };
        if (status === 'resolved' || status === 'closed') patch.resolved_at = new Date().toISOString();
        else patch.resolved_at = null;
        const { error } = await sb.from('bozo_contact_requests').update(patch).eq('id', id);
        if (error) return toast(readableError(error));
        toast(`Contact request marked ${status.replace('_',' ')}.`);
        loadOwnerPanel('contact');
      });
    });
    target.querySelectorAll('[data-copy-contact-email]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copyContactEmail || '');
          toast('Email copied.');
        } catch (_) {
          toast(button.dataset.copyContactEmail || 'Could not copy email');
        }
      });
    });
    return;
  }

  if (panel === 'import') {
    target.innerHTML = `
      <div class="panel-heading">
        <div><span>CANONICAL LIBRARY</span><h2>Import openings into Supabase</h2></div>
      </div>
      <div class="import-explainer">
        <p>
          This downloads the five CC0 Lichess opening files in your browser,
          combines them with BOZO custom variations, and safely upserts them
          into <code>public.openings</code> in batches.
        </p>
        <div class="import-summary">
          <span><b>Source</b>Lichess chess-openings + BOZO custom lines</span>
          <span><b>Destination</b>Supabase public.openings</span>
          <span><b>Safety</b>Existing IDs update, progress is preserved</span>
        </div>
        <button id="start-opening-import" class="button primary">
          Import full opening library
        </button>
        <div id="opening-import-status" class="import-status">
          Ready. This may take a few minutes.
        </div>
        <div class="import-progress"><div id="opening-import-progress-bar"></div></div>
      </div>`;
    $('start-opening-import').addEventListener('click', importOpeningLibrary);
    return;
  }

  if (panel === 'announcements') {
    target.innerHTML = `<div class="panel-heading"><div><span>BULLETIN</span><h2>Publish an announcement</h2></div></div>
      <div class="announcement-form">
        <input id="owner-announcement-title" maxlength="60" placeholder="Title">
        <div class="announcement-character-count"><span id="owner-announcement-title-count">0</span>/60</div>
        <textarea id="owner-announcement-body" maxlength="500" placeholder="Message"></textarea>
        <div class="announcement-character-count"><span id="owner-announcement-body-count">0</span>/500</div>
        <label><input id="owner-announcement-pin" type="checkbox" checked> Pin announcement</label>
        <button id="owner-publish-announcement" class="button primary">Publish</button>
      </div>
      <section class="announcement-manager">
        <div class="announcement-manager-head"><div><span class="eyebrow">MANAGE</span><h2>Existing announcements</h2></div><button id="owner-refresh-announcements" class="button secondary">Refresh</button></div>
        <div id="owner-announcement-list" class="announcement-manager-list"><div class="empty-state"><div>⌛</div><b>Loading announcements…</b></div></div>
      </section>`;
    $('owner-publish-announcement').addEventListener('click', publishAnnouncement);
    $('owner-refresh-announcements').addEventListener('click', loadOwnerAnnouncements);
    $('owner-announcement-title').addEventListener('input', e => $('owner-announcement-title-count').textContent = e.target.value.length);
    $('owner-announcement-body').addEventListener('input', e => $('owner-announcement-body-count').textContent = e.target.value.length);
    await loadOwnerAnnouncements();
    return;
  }

  const map = {
    submissions: ['opening_submissions','Opening review'],
    reports: ['reports','Open reports'],
    audit: ['moderation_actions','Audit history']
  };
  const [table, title] = map[panel];
  let request = sb.from(table).select('*').order('created_at',{ascending:false}).limit(50);
  if (panel === 'submissions') request = request.in('status',['pending','changes_requested']);
  if (panel === 'reports') request = request.in('status',['open','under_review','resolved','dismissed']);
  const { data, error } = await request;
  if (error) return ownerError(error);
  let rows = data || [];
  if (panel === 'reports') {
    rows = await Promise.all(rows.map(async item => {
      if (!item.screenshot_path) return item;
      const { data: signed } = await sb.storage.from(REPORT_SCREENSHOT_BUCKET).createSignedUrl(item.screenshot_path, 60 * 60);
      return { ...item, _screenshot_url: signed?.signedUrl || '' };
    }));
  }

  target.innerHTML = `<div class="panel-heading"><div><span>OWNER</span><h2>${title}</h2></div></div>
    <div class="owner-list">${rows.map(item => ownerCaseMarkup(panel, item)).join('') || '<div class="empty-state"><div>✓</div><b>Nothing waiting</b></div>'}</div>`;

  target.querySelectorAll('[data-case-status]').forEach(button => {
    button.addEventListener('click', () => updateCommunityCase(
      button.dataset.caseTable,
      button.dataset.caseId,
      button.dataset.caseStatus,
      panel
    ));
  });
}


function ownerContactMarkup(item) {
  const categoryLabels = {
    account:'Account / access',
    privacy:'Privacy / data',
    billing:'Billing / BOZO+',
    moderation:'Moderation appeal',
    fair_play:'Fair play dispute',
    legal:'Terms / legal',
    technical:'Technical',
    other:'Other'
  };
  const email = String(item.email || '');
  const username = item.username ? '@' + item.username : ' - ';
  const created = item.created_at ? new Date(item.created_at).toLocaleString() : '';
  return `<article class="owner-contact-card" data-contact-card="${escapeHtml(String(item.id || ''))}">
    <div>
      <div class="owner-contact-meta">
        <span>${escapeHtml(categoryLabels[item.category] || item.category || 'Other')}</span>
        <span>${escapeHtml(item.status || 'open')}</span>
        <span>${escapeHtml(created)}</span>
      </div>
      <h3>${escapeHtml(item.subject || 'Contact request')}</h3>
      <div class="owner-contact-message">${escapeHtml(item.message || '')}</div>
      <div class="owner-contact-details">
        <span><b>Email</b>${escapeHtml(email)}</span>
        <span><b>Username</b>${escapeHtml(username)}</span>
        <span><b>User ID</b>${escapeHtml(item.user_id || 'Guest / not signed in')}</span>
        <span><b>Page</b>${escapeHtml(item.page_url || item.route || ' - ')}</span>
      </div>
      <textarea class="owner-contact-notes" data-contact-notes placeholder="Private owner notes / resolution notes">${escapeHtml(item.owner_notes || '')}</textarea>
      <div class="owner-contact-actions">
        <button data-contact-id="${escapeHtml(String(item.id || ''))}" data-contact-status="in_review">Reviewing</button>
        <button data-contact-id="${escapeHtml(String(item.id || ''))}" data-contact-status="waiting_user">Waiting on user</button>
        <button data-contact-id="${escapeHtml(String(item.id || ''))}" data-contact-status="resolved">Resolved</button>
        <button data-contact-id="${escapeHtml(String(item.id || ''))}" data-contact-status="closed">Close</button>
        <button data-copy-contact-email="${escapeHtml(email)}">Copy email</button>
        <a href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('BOZO request ' + String(item.id || ''))}">Email user</a>
      </div>
    </div>
    <small>${escapeHtml(String(item.id || ''))}</small>
  </article>`;
}

function ownerCaseMarkup(panel, item) {
  if (panel === 'audit') {
    return `<div class="owner-list-row"><div><b>${escapeHtml(item.action || 'Action')}</b><small>${escapeHtml(item.reason || item.status || '')}</small></div><small>${new Date(item.created_at).toLocaleString()}</small></div>`;
  }
  const suggestion = panel === 'submissions';
  const heading = suggestion ? (item.proposed_name || 'Opening suggestion') : (item.report_type || 'Issue report');
  const type = suggestion ? item.submission_type : item.report_type;
  const details = item.notes || item.details || item.reason || '';
  const pgn = item.proposed_pgn || '';
  const approve = suggestion ? 'approved' : 'resolved';
  const reject = suggestion ? 'rejected' : 'dismissed';
  const table = suggestion ? 'opening_submissions' : 'reports';
  const screenshotUrl = !suggestion ? (item._screenshot_url || '') : '';
  return `<div class="owner-list-row community-case">
    <div class="community-case-main">
      <b>${escapeHtml(heading)}</b>
      <div class="community-case-meta"><span>${escapeHtml(type || 'other')}</span><span>${escapeHtml(item.status || '')}</span>${!suggestion && item.severity ? `<span>${escapeHtml(item.severity)}</span>` : ''}</div>
      ${details ? `<p>${escapeHtml(details)}</p>` : ''}
      ${!suggestion && item.page_url ? `<div class="report-context-grid"><span><b>Page</b>${escapeHtml(item.page_url)}</span><span><b>Viewport</b>${escapeHtml(item.viewport || ' - ')}</span><span><b>Opening</b>${escapeHtml(item.opening_name || item.target_id || ' - ')}</span><span><b>Move</b>${escapeHtml(String(item.move_number || ' - '))}</span></div>` : ''}
      ${!suggestion && item.fen ? `<code>FEN: ${escapeHtml(item.fen)}</code>` : ''}
      ${!suggestion && item.pgn ? `<details class="report-pgn"><summary>View attached PGN</summary><code>${escapeHtml(item.pgn)}</code></details>` : ''}
      ${screenshotUrl ? `<a class="report-screenshot-link" href="${escapeHtml(screenshotUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(screenshotUrl)}" alt="Attached issue screenshot"><span>Open full screenshot ↗</span></a>` : ''}
      ${pgn ? `<code>${escapeHtml(pgn)}</code>` : ''}
      <div class="community-case-actions">
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="under_review">Reviewing</button>
        ${suggestion ? '' : `<button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="under_review">Needs info</button>`}
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="${approve}">${suggestion ? 'Approve' : 'Fixed'}</button>
        <button data-case-table="${table}" data-case-id="${escapeHtml(String(item.id || ''))}" data-case-status="${reject}">${suggestion ? 'Reject' : 'Close'}</button>
      </div>
    </div>
    <small>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</small>
  </div>`;
}

async function updateCommunityCase(table, id, status, panel) {
  if (!id) return toast('This case has no ID.');
  const { error } = await sb.from(table).update({ status }).eq('id', id);
  if (error) return toast(readableError(error));
  toast(`Case marked ${status.replace('_',' ')}.`);
  loadOwnerPanel(panel);
}


let ownerOpeningEloRows=[];

function ownerOpeningEloMarkup(){
  return `<div class="panel-heading"><div><span>OPENING LIBRARY</span><h2>Opening Elo Manager</h2></div></div>
    <p class="profile-repertoire-help">Search any published opening or variation, then override the Elo range BOZO uses for rating-specific discovery. Saved owner ranges take priority over the automatic recommendation. Reset removes the override and returns that line to BOZO's calculated fallback.</p>
    <div class="owner-elo-toolbar"><input id="owner-opening-elo-search" placeholder="Search opening, variation, or ECO"><button id="owner-opening-elo-search-button" class="button primary" type="button">Search</button></div>
    <div class="owner-elo-legend"><span>300–3000 Elo</span><span>✓ Reviewed marks your manual decision</span><span>Up to 250 results per search</span></div>
    <div id="owner-opening-elo-results" class="owner-elo-list"></div>`;
}

async function ownerLoadOpeningElo(query=''){
  const out=$('owner-opening-elo-results'); if(!out)return;
  out.innerHTML='<div class="empty-state"><div>⌛</div><b>Loading opening ranges…</b></div>';
  const {data,error}=await sb.rpc('owner_search_opening_elo',{search_text:String(query||''),row_limit:250});
  if(error){out.innerHTML=`<div class="empty-state"><div>⚠</div><b>Could not load Elo ranges</b><span>${escapeHtml(readableError(error))}</span></div>`;return;}
  ownerOpeningEloRows=data||[];
  if(!ownerOpeningEloRows.length){out.innerHTML='<div class="empty-state"><div>♟</div><b>No openings found</b><span>Try an opening name, variation, or ECO code.</span></div>';return;}
  out.innerHTML=ownerOpeningEloRows.map(r=>{
    const fallback=openingLearningProfile({...r,recommended_min_elo:null,recommended_max_elo:null});
    const hasOverride=Number.isFinite(Number(r.recommended_min_elo))&&Number.isFinite(Number(r.recommended_max_elo));
    const min=hasOverride?Number(r.recommended_min_elo):fallback.min;
    const max=hasOverride?Number(r.recommended_max_elo):fallback.max;
    return `<article class="owner-elo-row" data-owner-elo-row="${escapeHtml(r.id)}">
      <div class="owner-elo-opening"><div><span>${escapeHtml(r.eco||'—')} · ${escapeHtml(r.source_type==='bozo'?'BOZO Custom':'Library')}</span><h3>${escapeHtml(r.name||'Opening')}</h3></div><small>${hasOverride?'OWNER OVERRIDE':'BOZO FALLBACK'}${r.elo_reviewed?' · ✓ REVIEWED':''}</small></div>
      <div class="owner-elo-controls">
        <label>Minimum Elo<input data-owner-elo-min type="number" min="300" max="3000" step="100" value="${min}"></label>
        <label>Maximum Elo<input data-owner-elo-max type="number" min="300" max="3000" step="100" value="${max}"></label>
        <label class="owner-elo-reviewed"><input data-owner-elo-reviewed type="checkbox" ${r.elo_reviewed?'checked':''}> Reviewed</label>
        <button class="button primary small" data-owner-elo-save type="button">Save range</button>
        <button class="button ghost small" data-owner-elo-reset type="button" ${hasOverride?'':'disabled'}>Reset</button>
      </div>
      <div class="owner-elo-status">${hasOverride?`Saved ${min}–${max}`:`Calculated fallback ${min}–${max}`}</div>
    </article>`;
  }).join('');
  out.querySelectorAll('[data-owner-elo-save]').forEach(b=>b.addEventListener('click',()=>ownerSaveOpeningElo(b.closest('[data-owner-elo-row]'))));
  out.querySelectorAll('[data-owner-elo-reset]').forEach(b=>b.addEventListener('click',()=>ownerResetOpeningElo(b.closest('[data-owner-elo-row]'))));
}

async function ownerSaveOpeningElo(card){
  if(!card)return; const id=card.dataset.ownerEloRow;
  const min=Number(card.querySelector('[data-owner-elo-min]')?.value),max=Number(card.querySelector('[data-owner-elo-max]')?.value);
  const reviewed=Boolean(card.querySelector('[data-owner-elo-reviewed]')?.checked);
  if(!Number.isFinite(min)||!Number.isFinite(max)||min<300||max>3000||min>max)return toast('Use a valid Elo range from 300 to 3000.');
  const save=card.querySelector('[data-owner-elo-save]'); if(save){save.disabled=true;save.textContent='Saving…';}
  const {error}=await sb.rpc('owner_set_opening_elo',{p_opening_id:id,p_min_elo:Math.round(min),p_max_elo:Math.round(max),p_reviewed:reviewed});
  if(error){if(save){save.disabled=false;save.textContent='Save range';}return toast(readableError(error));}
  toast(`Opening range saved: ${Math.round(min)}–${Math.round(max)} Elo.`);
  await ownerLoadOpeningElo($('owner-opening-elo-search')?.value||'');
}

async function ownerResetOpeningElo(card){
  if(!card)return; const id=card.dataset.ownerEloRow;
  if(!confirm('Remove this owner Elo override and return to BOZO\'s calculated recommendation?'))return;
  const {error}=await sb.rpc('owner_reset_opening_elo',{p_opening_id:id});
  if(error)return toast(readableError(error));
  toast('Owner Elo override removed.');
  await ownerLoadOpeningElo($('owner-opening-elo-search')?.value||'');
}

function analyticsStat(value,label){return `<div class="analytics-stat"><b>${Number(value||0).toLocaleString()}</b><span>${label}</span></div>`}
function ownerError(error){$('owner-panel').innerHTML=`<div class="empty-state"><div>⚠</div><b>Owner tool failed</b><span>${escapeHtml(readableError(error))}</span></div>`}

async function ownerSearchUsers() {
  const query = $('owner-user-search').value.trim();
  if (!query) return;
  const out = $('owner-user-results');
  out.innerHTML = 'Searching…';
  const { data, error } = await sb.rpc('owner_search_users',{ search_text: query });
  if (error) return out.innerHTML = escapeHtml(readableError(error));
  out.innerHTML = (data || []).map(u => `
    <div class="user-card"><div class="user-card-head"><div><b>${escapeHtml(u.ign)}</b><span>@${escapeHtml(u.username)}</span></div><div class="role-badge ${u.role==='owner'?'owner':''}">${roleLabel(u.role)}</div></div>
    <p>${Number(u.xp||0).toLocaleString()} XP · ${Number(u.opening_mastery||0).toLocaleString()} mastery · ${u.is_suspended?'Suspended':'Active'}${u.chess_title ? ` · ${escapeHtml(u.chess_title)}` : ''}${u.bozo_title ? ` · ${escapeHtml(u.bozo_title)}` : ''}${u.identity_verified ? ' · Verified' : ''}</p>
    <div class="owner-supporter-actions">
      <button class="button secondary small" data-supporter-grant="${escapeHtml(u.username)}">Grant BOZO+</button>
      <button class="button ghost small" data-supporter-revoke="${escapeHtml(u.username)}">Revoke BOZO+</button>
      <button class="button secondary small" data-verify-user="${escapeHtml(u.username)}">Verify identity</button>
      <button class="button ghost small" data-title-remove="${escapeHtml(u.username)}">Remove chess title</button>
      <button class="button secondary small" data-bm-grant="${escapeHtml(u.username)}">Grant BM</button>
      <button class="button ghost small" data-bm-revoke="${escapeHtml(u.username)}">Revoke BM</button>
      <button class="button secondary small" data-name-override="${escapeHtml(u.username)}">Allow exact name</button>
      <button class="button ghost small" data-force-rename="${escapeHtml(u.username)}">Rename</button>
    </div></div>
  `).join('') || 'No users found.';
  out.querySelectorAll('[data-supporter-grant]').forEach(button => button.addEventListener('click', async () => {
    const { error } = await sb.rpc('owner_set_bozo_supporter', { target_username: button.dataset.supporterGrant, enabled: true });
    if (error) return toast(readableError(error));
    toast(`BOZO+ granted to @${button.dataset.supporterGrant}`);
  }));
  out.querySelectorAll('[data-supporter-revoke]').forEach(button => button.addEventListener('click', async () => {
    const { error } = await sb.rpc('owner_set_bozo_supporter', { target_username: button.dataset.supporterRevoke, enabled: false });
    if (error) return toast(readableError(error));
    toast(`BOZO+ revoked from @${button.dataset.supporterRevoke}`);
  }));
  out.querySelectorAll('[data-verify-user]').forEach(b=>b.addEventListener('click',async()=>{ const {error}=await sb.rpc('owner_set_identity_verified',{target_username:b.dataset.verifyUser,enabled:true}); if(error)return toast(readableError(error)); toast('Identity verified.'); }));
  out.querySelectorAll('[data-title-remove]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm(`Remove the verified chess title from @${b.dataset.titleRemove}?`)) return;
    const {error}=await sb.rpc('staff_set_chess_title',{target_username:b.dataset.titleRemove,title_value:null});
    if(error)return toast(readableError(error));
    toast('Chess title removed.'); ownerSearchUsers();
  }));
  out.querySelectorAll('[data-bm-grant]').forEach(b=>b.addEventListener('click',async()=>{ const {error}=await sb.rpc('owner_set_bozo_title',{target_username:b.dataset.bmGrant,title_value:'BM'}); if(error)return toast(readableError(error)); toast('BM granted.'); }));
  out.querySelectorAll('[data-bm-revoke]').forEach(b=>b.addEventListener('click',async()=>{ const {error}=await sb.rpc('owner_set_bozo_title',{target_username:b.dataset.bmRevoke,title_value:null}); if(error)return toast(readableError(error)); toast('BM revoked.'); }));
  out.querySelectorAll('[data-name-override]').forEach(b=>b.addEventListener('click',async()=>{ const exact=prompt('Exact IGN or username to allow'); if(!exact)return; const reason=prompt('Private reason for override')||''; const {error}=await sb.rpc('owner_allow_exact_name',{name_value:exact,reason_text:reason}); if(error)return toast(readableError(error)); toast('Exact-name override added.'); }));
  out.querySelectorAll('[data-force-rename]').forEach(b=>b.addEventListener('click',async()=>{ const next=prompt(`New username for @${b.dataset.forceRename}`); if(!next)return; const reason=prompt('Reason for rename')||''; const {error}=await sb.rpc('owner_force_rename',{target_username:b.dataset.forceRename,new_username:next,reason_text:reason}); if(error)return toast(readableError(error)); toast('Account renamed.'); ownerSearchUsers(); }));
}

async function loadOwnerAnnouncements() {
  const list = $('owner-announcement-list');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading announcements…</b></div>';
  const { data, error } = await sb.rpc('owner_list_announcements');
  if (error) {
    list.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load announcements</b><span>${escapeHtml(readableError(error))}</span></div>`;
    return;
  }
  list.innerHTML = (data || []).map(item => `
    <article class="announcement-manager-row" data-announcement-id="${escapeHtml(String(item.id))}">
      <div>
        <h3>${escapeHtml(item.title || 'Untitled')}</h3>
        <p>${escapeHtml(item.body || '')}</p>
        <div class="announcement-manager-meta">
          <span>${item.is_pinned ? '📌 Pinned' : 'Not pinned'}</span>
          <span>${item.is_active ? 'Live' : 'Hidden'}</span>
          <span>${item.created_at ? new Date(item.created_at).toLocaleString() : ''}</span>
        </div>
      </div>
      <div class="announcement-manager-actions">
        <button class="button secondary" data-announcement-action="edit">Edit</button>
        <button class="button secondary" data-announcement-action="pin">${item.is_pinned ? 'Unpin' : 'Pin'}</button>
        <button class="button secondary" data-announcement-action="active">${item.is_active ? 'Hide' : 'Show'}</button>
        <button class="button secondary" data-announcement-action="delete">Delete</button>
      </div>
    </article>`).join('') || '<div class="empty-state"><div>📣</div><b>No announcements yet</b></div>';

  list.querySelectorAll('[data-announcement-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const row = button.closest('[data-announcement-id]');
      const item = (data || []).find(entry => String(entry.id) === row?.dataset.announcementId);
      if (!item) return;
      const action = button.dataset.announcementAction;
      if (action === 'edit') {
        const title = prompt('Announcement title', item.title || '');
        if (title === null) return;
        const body = prompt('Announcement message', item.body || '');
        if (body === null) return;
        if (!title.trim() || !body.trim()) return toast('Title and message are required.');
        const { error } = await sb.rpc('owner_update_announcement', {
          announcement_id: item.id,
          announcement_title: title.trim().slice(0, 60),
          announcement_body: body.trim().slice(0, 500),
          pin_announcement: item.is_pinned,
          activate_announcement: item.is_active
        });
        if (error) return toast(readableError(error));
        toast('Announcement updated.');
      } else if (action === 'delete') {
        if (!confirm(`Delete “${item.title}”?`)) return;
        const { error } = await sb.rpc('owner_delete_announcement', { announcement_id: item.id });
        if (error) return toast(readableError(error));
        toast('Announcement deleted.');
      } else {
        const { error } = await sb.rpc('owner_update_announcement', {
          announcement_id: item.id,
          announcement_title: item.title,
          announcement_body: item.body,
          pin_announcement: action === 'pin' ? !item.is_pinned : item.is_pinned,
          activate_announcement: action === 'active' ? !item.is_active : item.is_active
        });
        if (error) return toast(readableError(error));
        toast(action === 'pin' ? (item.is_pinned ? 'Announcement unpinned.' : 'Announcement pinned.') : (item.is_active ? 'Announcement hidden.' : 'Announcement shown.'));
      }
      await loadOwnerAnnouncements();
      await loadAnnouncement();
    });
  });
}

async function publishAnnouncement() {
  const title = $('owner-announcement-title').value.trim();
  const body = $('owner-announcement-body').value.trim();
  if (!title || !body) return toast('Add a title and message.');
  const { error } = await sb.rpc('publish_announcement',{
    announcement_title:title,
    announcement_body:body,
    pin_announcement:$('owner-announcement-pin').checked
  });
  if (error) return toast(readableError(error));
  toast('Announcement published.');
  $('owner-announcement-title').value = '';
  $('owner-announcement-body').value = '';
  $('owner-announcement-title-count').textContent = '0';
  $('owner-announcement-body-count').textContent = '0';
  await loadOwnerAnnouncements();
  await loadAnnouncement();
}


const OPENING_TSV_URLS = [
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv',
  'https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv'
];

const BOZO_CLOUD_OPENINGS = [
  {
    eco:'A09',
    name:'Réti Opening: Polish Grob Attack',
    variation:'Bozo Main Line',
    pgn:'1. Nf3 d5 2. b4 Nf6 3. Bb2 g6 4. h3 Bg7 5. g4 Qd6 6. a3 c5 7. g5 Nh5 8. Bxg7 Nxg7 9. bxc5 Qxc5 10. e3 O-O 11. d4 Qc7 12. Nbd2 Be6 13. h4 Nd7 14. Qb1 Bg4 15. Bd3 e5 16. Nxe5 Nxe5 17. dxe5 Qxe5 18. O-O Bh3 19. Re1 f6 20. f4 Qe6 21. Qd1 Bg4 22. Nf3 Qd6 23. gxf6 Qxf6 24. Be2 Rad8 25. Qd4 Qe7 26. Ng5 Bxe2 27. Rxe2 Nf5 28. Qd3 Nxh4 29. Rh2 Rf5 30. Kh1 h6 31. Rg1 hxg5 32. Rxh4 gxh4 33. Rxg6+ Kh7 34. Qxf5 Qe4+ 35. Qxe4 dxe4 36. Re6 Rd2 37. c4 Re2 38. Rxe4',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom Réti system that develops into a Polish-Grob pawn expansion.',
    author_explanations: {
      "1": "This move develops our knight to control e5 allowing for b4 and bb2 hitting g7 without an easy central pawn expansion from black to block the diagonal which leads to black playing Nf6 where we then go for h3 g4.",
      "2": "This move aims to expand into the center, allowing the queen to come out on the d file and play for e6 or c5.",
      "3": "This move prepares a flank fianchetto for our bishop, which will land on the b2 square next move, given black cannot easily play e5 to cut off the diagonal reaching to g7 where if taken by white’s bishop the black rook on h8 would become undefended.",
      "4": "This move aims to defend the aforementioned diagonal from white’s bishop on b2 while developing a knight towards the center, defending d5 if black plans to bring the queen out.",
      "5": "As stated before, this move looks to apply pressure on the long diagonal, which is currently guarded by black’s knight on f6, our next few moves will look to weaken the knight and force it to move.",
      "6": "This move aims to fianchetto black’s bishop and prepare for a king side castle which would then anchor black’s knight and prevent white from creating doubled pawns (*note - doubled pawns on the kingside aren't always a bad thing depending on where the opponent has castled and how active your rook on that side of the board is, many counterattacks succeed because of doubled pawns that open a file for attack.)",
      "7": "This move aims to anchor a g4 push so that we can then play g5 and kick away the knight, while also creating a luft for our king if we plan to king side castle.",
      "8": "Fianchettos the black bishop and prepares to king side castle.",
      "9": "As previously stated, this move aims to play g5 eventually and kick out the black knight.",
      "10": "This move temporarily disrupts white’s plan of attack as the b4 pawn is now hanging.",
      "11": "This defends our b4 pawn allowing us to play g5 without having to worry about losing a pawn later on. As for why we didn’t play g5 immediately as the threat on black’s knight would be greater than their threat on our pawn, that is just how I prefer to play the opening, if you wish to play g5 and play out that sequence and then a3, more power to you, I just find that defending b4 first is a more flexible option.",
      "12": "Black aims to further threaten the b4 pawn and expand into the center.",
      "13": "This is where the main idea of this opening finally shines, as we kick out the black knight and aim to trade bishops, making the black structure seem a bit incoherent.",
      "14": "This guards black’s bishop, aiming to recapture after white trades.",
      "15": "Trading off black’s strong bishop allows white to not have to worry about repositioning their own bishop later on as black continues to expand into the center.",
      "16": "Recaptures.",
      "17": "Since our queenside expansion has served its purpose, we capture one of blacks central pawns, weakening their control over the board.",
      "18": "Recaptures.",
      "19": "Aims to develop our bishop and eventually castle, this move also opens up our queen.",
      "20": "Black castles, aiming to place a rook on e8 and play for e5 to gain more central control.",
      "21": "This move aims to gain central control and attack black’s queen, while building a potential outpost for our knight to go to e5.",
      "22": "Black retreats the queen and repositions it to target our kingside.",
      "23": "Develops our knight and plans to replace the f3 knight once it goes to e5.",
      "24": "Develops the bishop and prevents us from immediately playing c4 to challenge black’s center.",
      "25": "This move aims to strengthen the g5 pawn and potentially play for h5 in the future to strike at black’s kingside.",
      "26": "Black further completes their development and prepares to play e5 once their bishop relocates to strike at our center.",
      "27": "This move aims to target the open b-file and potentially capture on b7 after black initiates trades in the center, however we would need to castle before acting on this plan so that our rook on a1 isn’t unprotected.",
      "28": "Black relocates their bishop and aims to either play e5 immediately or trade off their bad bishop for our active knight.",
      "29": "We develop our bishop to both target black’s kingside should our plan to play h5 come into fruition and allows us to castle king side after trading off in the center.",
      "30": "Black initiates a sequence of trades in the center to move into the endgame.",
      "31": "Trading sequence.",
      "32": "Trading sequence.",
      "33": "Trading sequence.",
      "34": "Trading sequence.",
      "35": "We king side castle, which may seem a bit unorthodox given we played a pawn storm on this side of the board earlier on, but black has no real way to threaten a checkmate currently as we traded off their dark squared bishop and their knight would take multiple moves to reposition itself in a meaningful way.",
      "36": "Black plays a one move threat on our rook.",
      "37": "Retreats our rook to a safe square while defending e4 so that we can later play f4 and kick away black’s queen.",
      "38": "Black aims to weaken our kingside and infiltrate with the queen after an exchange of pawns.",
      "39": "Kicks away the black queen and further strengthens g5.",
      "40": "Black retreats their queen and aims to infiltrate on g4.",
      "41": "This move prevents black from play Qg4+ without trading off queens.",
      "42": "Black makes a threat onto our queen.",
      "43": "We both activate our knight onto a better square and defend our queen, and while this also may seem a bit counterintuitive as we walk into a pin, but the worst black can really do is just trade off our knight for their bishop, which just kills off their attack.",
      "44": "Black just plays a waiting move as they don’t really have any initiative in the current position.",
      "45": "This move both aims to open up black’s king and allow us to reposition our knight to g5 later on.",
      "46": "Recapturing with the queen creates a battery on the f-file and discourages us from playing e4.",
      "47": "This move breaks the pin on our knight to our queen, giving both pieces freedom of mobility to reposition and attack black’s weakened king side.",
      "48": "Black repositions their inactive rook and aims to potentially play d4 and initiate a trading sequence that could leave our f4 pawn vulnerable.",
      "49": "Stops black from playing d4 and aims to trade queens and reposition our knight upon recapturing.",
      "50": "Black retreats their queen.",
      "51": "We bring our knight into the attack and look to trade off black’s active bishop, allowing us to position our rook on h2 upon recapturing to further coordinate with our attack.",
      "52": "Trading sequence.",
      "53": "Trading sequence, our rook is now more active on the 2nd rank and can reposition to h2 to pressure black’s king.",
      "54": "Black forks our queen and h4 pawn.",
      "55": "We retreat our queen.",
      "56": "Black takes our undefended pawn.",
      "57": "We attack black’s undefended knight.",
      "58": "Black plays a rather tricky move, and if we simply take their hanging knight they sack their rook for our knight, and upon our pawn recapture the take our pawn with their queen, delivering both a check and threat onto our hanging rook on h4 should we just take their hanging knight.",
      "59": "Slide our king out of the way to both avoid black’s trick and allow our rook on a1 to get into the game on g1.",
      "60": "Black attacks our knight.",
      "61": "We play a trick of our own, as the following sequence will not only result in an equal trade, but also result in us having a severe threat on the black king.",
      "62": "This begins the sequence after Rg1.",
      "63": "This continues the sequence after Rg1.",
      "64": "This continues the sequence after Rg1.",
      "65": "This continues the sequence after Rg1.",
      "66": "This continues the sequence after Rg1.",
      "67": "After this sequence black only has 1 move to not lose on the spot.",
      "68": "This is black’s ONLY move here, as any other move would result in a discovered check to win black’s queen.",
      "69": "We trade queens.",
      "70": "We trade queens.",
      "71": "We target black’s weak e4 pawn.",
      "72": "Black attacks our c2 pawn.",
      "73": "We advance our pawn to defend it from black’s rook.",
      "74": "Black attacks our e3 pawn and aims to advance their h pawn down the board.",
      "75": "We capture black’s hanging pawn."
}
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'Main Line',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 O-O 7. Qb3',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom variation combining the Polish setup with a Grob-style g-pawn expansion.',
    author_explanations: {
      "1": "White gains queenside space with b4 and, more importantly, clears b2 so the c1-bishop can develop there. The usual idea is Bb2, putting the bishop on the long diagonal and letting White influence the center from the flank rather than occupying it immediately with a central pawn.",
      "2": "Black develops the kingside knight to f6, bringing a minor piece into the game and putting pressure on the central e4 square. The move keeps Black flexible because the central pawns have not committed yet, while also moving Black closer to a normal kingside setup.",
      "3": "Bb2 completes the immediate idea behind 1.b4. White develops the c1-bishop onto the long diagonal, where it can influence the center and become an active part of the position instead of remaining blocked on its starting square.",
      "4": "Black plays ...g6 to prepare ...Bg7. The point is to fianchetto the dark-squared bishop, develop it onto its own long diagonal, and build a flexible kingside setup that can lead to castling.",
      "5": "White begins the Grob-style part of the setup with g4. The pawn gains kingside space and prepares g5, which can question the knight on f6 and force Black to decide where that knight belongs.",
      "6": "...Bg7 carries out the plan behind ...g6. Black develops the bishop onto the long diagonal and clears the f8 square, making kingside castling available once the king and rook are ready.",
      "7": "White pushes g5 and attacks the knight on f6, gaining space with tempo. The move is concrete: the knight must react, and White uses the advanced g-pawn to disrupt Black's comfortable kingside development.",
      "8": "...Nh5 moves the attacked knight out of danger while keeping it near the kingside. Black accepts a less central knight placement in order to preserve the piece and continue developing.",
      "9": "Bxg7 removes Black's fianchettoed bishop. White gives up the active b2-bishop to eliminate a key kingside defender and changes the character of the long diagonal before Black can settle into a normal castled setup.",
      "10": "...Nxg7 recaptures the bishop and restores material equality. The knight is pulled to g7, so Black keeps the piece but ends up with a less conventional kingside arrangement than the one intended after ...g6 and ...Bg7.",
      "11": "White plays c4 to claim more space and challenge the center from the queenside. It also gives White another pawn that can support central expansion later rather than relying only on the flank pawns.",
      "12": "Black castles kingside, placing the king in safety and activating the h8-rook. Even with the unusual knight placement on g7, castling completes an important part of Black's development.",
      "13": "Qb3 develops the queen to an active square and adds pressure along the b-file and diagonal toward the center. It also connects naturally with White's queenside space advantage and the pressure created by the earlier b-pawn advance."
    },
    author_takeaways: {
      "1": "The main point of b4 is to gain queenside space and prepare Bb2, developing the bishop onto the long diagonal.",
      "2": "Develop the knight to f6, influence the center, and keep Black's setup flexible.",
      "3": "Bb2 is the payoff of 1.b4: develop the bishop and use the long diagonal.",
      "4": "...g6 prepares ...Bg7 and a flexible kingside fianchetto.",
      "5": "g4 gains space with the concrete plan of g5 against the f6-knight.",
      "6": "...Bg7 completes the fianchetto and prepares kingside castling.",
      "7": "g5 gains space with tempo by forcing the f6-knight to move.",
      "8": "...Nh5 preserves the knight after g5 attacks it.",
      "9": "Bxg7 trades off Black's fianchettoed bishop and changes the kingside structure.",
      "10": "...Nxg7 recaptures but leaves the knight on an unusual square.",
      "11": "c4 adds queenside and central space and gives White another way to challenge the center.",
      "12": "Castling secures the king and activates the rook.",
      "13": "Qb3 activates the queen and builds on White's queenside pressure."
    }
  },
  {
    eco:'A00',
    name:"Polish Opening: King's Indian, Polish Grob Attack",
    variation:'h5 Counterstrike',
    pgn:'1. b4 Nf6 2. Bb2 g6 3. g4 Bg7 4. g5 Nh5 5. Bxg7 Nxg7 6. c4 h5 7. gxh6 Rxh6 8. Qb3',
    source_type:'bozo',
    repertoire_side:'white',
    notes:'A BOZO custom branch where Black challenges the advanced g-pawn with ...h5.',
    author_explanations: {
      "1": "White gains queenside space with b4 and clears b2 so the c1-bishop can develop there. The central opening idea is to follow with Bb2 and use the long diagonal from the flank.",
      "2": "Black develops the kingside knight to f6, bringing a minor piece into the game, influencing the center, and keeping the central pawn structure flexible.",
      "3": "Bb2 completes the immediate purpose of 1.b4 by developing the bishop onto the long diagonal.",
      "4": "...g6 prepares ...Bg7, giving Black a natural fianchetto and a route toward kingside castling.",
      "5": "g4 gains kingside space and prepares g5, a direct way to question the knight on f6.",
      "6": "...Bg7 completes the fianchetto and develops the bishop onto the long diagonal.",
      "7": "g5 attacks the f6-knight and gains space with tempo, forcing Black to respond to the pawn advance.",
      "8": "...Nh5 moves the knight out of attack while keeping it near the kingside.",
      "9": "Bxg7 removes Black's fianchettoed bishop and changes the kingside before Black can complete a standard setup.",
      "10": "...Nxg7 recaptures, restoring material while relocating the knight to g7.",
      "11": "c4 gains more queenside and central space and gives White another pawn lever against Black's center.",
      "12": "...h5 immediately challenges White's advanced g-pawn instead of castling. Black tries to undermine the pawn chain before White can consolidate the extra kingside space.",
      "13": "gxh6 accepts the challenge and opens the h-file. White gives up the advanced g-pawn structure in exchange for changing Black's kingside pawn cover and forcing a recapture.",
      "14": "...Rxh6 recaptures on h6, restoring the pawn while activating the rook along the h-file.",
      "15": "Qb3 activates the queen and returns White's attention to the queenside and center after the kingside exchanges."
    },
    author_takeaways: {
      "1": "The main point of b4 is to gain queenside space and prepare Bb2.",
      "2": "...Nf6 develops the knight and keeps Black flexible.",
      "3": "Bb2 develops the bishop onto the long diagonal.",
      "4": "...g6 prepares the bishop fianchetto with ...Bg7.",
      "5": "g4 prepares g5 against the f6-knight.",
      "6": "...Bg7 completes Black's fianchetto.",
      "7": "g5 gains space with tempo by attacking the knight.",
      "8": "...Nh5 preserves the knight after g5.",
      "9": "Bxg7 removes Black's fianchettoed bishop.",
      "10": "...Nxg7 recaptures and relocates the knight.",
      "11": "c4 adds space and another way to challenge the center.",
      "12": "...h5 attacks White's advanced pawn chain before it can settle.",
      "13": "gxh6 opens the h-file and forces Black to recapture.",
      "14": "...Rxh6 restores the pawn and activates the rook.",
      "15": "Qb3 activates the queen after the kingside exchanges."
    }
  }
];

function parseOpeningTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split('\t');
  const ecoIndex = header.indexOf('eco');
  const nameIndex = header.indexOf('name');
  const pgnIndex = header.indexOf('pgn');

  return lines.map(line => {
    const cols = line.split('\t');
    return {
      eco: cols[ecoIndex] || null,
      name: cols[nameIndex] || 'Unnamed Opening',
      pgn: cols[pgnIndex] || '',
      source_type: 'official',
      variation: null,
      notes: null
    };
  }).filter(row => row.pgn);
}

function openingId(row) {
  const raw = `${row.eco}|${row.name}|${row.variation || ''}|${row.pgn}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const slug = row.name.toLowerCase()
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'')
    .slice(0,58);
  return `${row.source_type === 'bozo' ? 'bozo' : 'eco'}-${slug}-${(hash >>> 0).toString(36)}`;
}

async function importOpeningLibrary() {
  if (state.role !== 'owner') return toast('Only the Owner can import the canonical library.');

  const button = $('start-opening-import');
  const status = $('opening-import-status');
  const bar = $('opening-import-progress-bar');
  button.disabled = true;

  try {
    status.textContent = 'Downloading opening data…';
    bar.style.width = '4%';

    const chunks = [];
    for (let i = 0; i < OPENING_TSV_URLS.length; i++) {
      const response = await fetch(OPENING_TSV_URLS[i], { cache:'no-store' });
      if (!response.ok) throw new Error(`Opening source ${response.status}`);
      chunks.push(...parseOpeningTsv(await response.text()));
      bar.style.width = `${8 + ((i + 1) / OPENING_TSV_URLS.length) * 22}%`;
      status.textContent = `Downloaded ECO volume ${i + 1} of ${OPENING_TSV_URLS.length}…`;
    }

    const seen = new Set();
    const rows = [...BOZO_CLOUD_OPENINGS, ...chunks].map(row => ({
      id: openingId(row),
      eco: row.eco,
      name: row.name,
      variation: row.variation,
      pgn: row.pgn,
      source_type: row.source_type,
      status: 'published',
      notes: row.notes,
      metadata: {
        imported_from: row.source_type === 'official'
          ? 'lichess-org/chess-openings'
          : 'bozos-opening-trainer',
        imported_at: new Date().toISOString(),
        author_explanations: row.author_explanations || null,
        repertoire_side: row.repertoire_side || null
      }
    })).filter(row => {
      const key = `${row.name}|${row.variation || ''}|${row.pgn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const batchSize = 150;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const { error } = await sb.rpc('owner_import_openings', { opening_rows: batch });
      if (error) throw error;

      const completed = Math.min(start + batch.length, rows.length);
      const pct = 30 + (completed / rows.length) * 70;
      bar.style.width = `${pct}%`;
      status.textContent = `Imported ${completed.toLocaleString()} of ${rows.length.toLocaleString()} openings…`;
    }

    bar.style.width = '100%';
    status.innerHTML = `<b>Import complete.</b> ${rows.length.toLocaleString()} published openings are now available to both web and Android.`;
    toast('Opening library imported');
  } catch (error) {
    status.innerHTML = `<b>Import stopped:</b> ${escapeHtml(readableError(error))}`;
    toast(readableError(error));
  } finally {
    button.disabled = false;
  }
}



let friendFilter = 'accepted';
let webFriends = [];

let socialSection = 'friends';
let clubFilter = 'mine';
let webClubs = [];

function renderFriends() {
  const signedIn = Boolean(state.session?.user);
  $('friends-guest').hidden = signedIn;
  $('friends-user').hidden = !signedIn;
  if (!signedIn) return;
  paintSocialSection();
  loadWebFriends();
  loadWebClubs();
}

function paintSocialSection() {
  const friends = socialSection === 'friends';
  $('social-friends-section').hidden = !friends;
  $('social-clubs-section').hidden = friends;
  $('add-web-friend-button').hidden = !friends;
  $('create-club-button').hidden = friends;
  $('social-heading-title').textContent = friends ? 'Your chess circle.' : 'Find your club.';
  $('social-heading-copy').textContent = friends
    ? 'Add players by username, study together, and challenge them to exact openings.'
    : 'Join communities, host club arenas, and compete together.';
  $$('[data-social-section]').forEach(b => b.classList.toggle('active', b.dataset.socialSection === socialSection));
}

$$('[data-social-section]').forEach(button => button.addEventListener('click', () => {
  socialSection = button.dataset.socialSection;
  paintSocialSection();
  if (socialSection === 'clubs') loadWebClubs();
}));

$$('[data-club-filter]').forEach(button => button.addEventListener('click', () => {
  clubFilter = button.dataset.clubFilter;
  $$('[data-club-filter]').forEach(b => b.classList.toggle('active', b === button));
  loadWebClubs();
}));

async function loadWebClubs() {
  if (!state.session) return;
  const out = $('web-clubs-list');
  if (!out) return;
  out.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading clubs…</b></div>';
  const { data, error } = await sb.rpc('bozo_list_clubs', { list_mode: clubFilter });
  if (error) {
    out.innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  webClubs = data || [];
  paintWebClubs();
}

function paintWebClubs() {
  const out = $('web-clubs-list');
  if (!webClubs.length) {
    out.innerHTML = `<div class="empty-state"><div>♟</div><b>No clubs here yet</b><span>${clubFilter === 'mine' ? 'Create one or discover a community.' : 'Check back as the BOZO community grows.'}</span></div>`;
    return;
  }
  out.innerHTML = webClubs.map(c => `
    <article class="club-card">
      <div class="club-card-top">
        <div class="club-avatar">${c.icon_url ? `<img src="${escapeHtml(c.icon_url)}" alt="">` : escapeHtml((c.name || 'B').slice(0,1).toUpperCase())}</div>
        <div><span>${c.visibility === 'private' ? 'PRIVATE CLUB' : 'PUBLIC CLUB'}</span><h3>${escapeHtml(c.name)}</h3><p>@${escapeHtml(c.slug)}</p></div>
      </div>
      <p>${escapeHtml(c.description || 'No description yet.')}</p>
      <div class="club-card-meta"><span>${Number(c.member_count || 0)} members</span>${c.my_role ? `<span>${escapeHtml(c.my_role)}</span>` : ''}</div>
      <div class="club-card-actions">
        ${c.my_role ? `<button class="button secondary small" data-club-open="${c.id}">Club page</button>` :
          c.invite_status === 'pending' ? `<button class="button primary small" data-club-accept="${c.id}">Accept invite</button>` :
          `<button class="button primary small" data-club-join="${c.id}">${c.visibility === 'private' ? 'Request / invite only' : 'Join club'}</button>`}
      </div>
    </article>`).join('');

  out.querySelectorAll('[data-club-join]').forEach(b => b.addEventListener('click', async () => {
    const club = webClubs.find(c => String(c.id) === String(b.dataset.clubJoin));
    const rpc = club?.visibility === 'private' ? 'bozo_request_club_join' : 'bozo_join_club';
    const { error } = await sb.rpc(rpc, { target_club_id: b.dataset.clubJoin });
    if (error) return toast(readableError(error));
    toast(club?.visibility === 'private' ? 'Join request sent.' : 'Joined club.');
    if (club?.visibility !== 'private') clubFilter = 'mine';
    await loadWebClubs();
  }));
  out.querySelectorAll('[data-club-accept]').forEach(b => b.addEventListener('click', async () => {
    const { error } = await sb.rpc('bozo_accept_club_invite', { target_club_id: b.dataset.clubAccept });
    if (error) return toast(readableError(error));
    toast('Club invitation accepted.');
    clubFilter = 'mine';
    await loadWebClubs();
  }));
  out.querySelectorAll('[data-club-open]').forEach(b => b.addEventListener('click', () => {
    openClubDetail(b.dataset.clubOpen);
  }));
}


let activeClubDetailId = null;
let activeClubDetailTab = 'overview';
let activeClubDetail = null;
let activeClubMembers = [];

function closeClubDetail() {
  activeClubDetailId = null;
  $('club-detail-modal').hidden = true;
}

$('close-club-detail')?.addEventListener('click', closeClubDetail);
$('club-detail-modal')?.addEventListener('click', event => {
  if (event.target === $('club-detail-modal')) closeClubDetail();
});
$$('[data-club-detail-tab]').forEach(button => button.addEventListener('click', () => {
  activeClubDetailTab = button.dataset.clubDetailTab;
  $$('[data-club-detail-tab]').forEach(b => b.classList.toggle('active', b === button));
  paintClubDetailTab();
}));

async function openClubDetail(clubId) {
  activeClubDetailId = clubId;
  activeClubDetailTab = 'overview';
  $$('[data-club-detail-tab]').forEach(b => b.classList.toggle('active', b.dataset.clubDetailTab === 'overview'));
  $('club-detail-modal').hidden = false;
  $('club-detail-body').innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading club…</b></div>';

  const [{ data: club, error }, { data: members }] = await Promise.all([
    sb.rpc('bozo_get_club', { target_club_id: clubId }),
    sb.rpc('bozo_list_club_members', { target_club_id: clubId })
  ]);

  if (error) {
    $('club-detail-body').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }

  activeClubDetail = Array.isArray(club) ? club[0] : club;
  activeClubMembers = members || [];
  paintClubDetailHeader();
  paintClubDetailTab();
}

function paintClubDetailHeader() {
  const c = activeClubDetail;
  if (!c) return;
  $('club-detail-header').innerHTML = `
    <div class="club-detail-brand">
      <div class="club-avatar large">${c.icon_url ? `<img src="${escapeHtml(c.icon_url)}" alt="">` : escapeHtml((c.name||'B').slice(0,1).toUpperCase())}</div>
      <div>
        <span class="eyebrow">${c.visibility === 'private' ? 'PRIVATE CLUB' : 'PUBLIC CLUB'}</span>
        <h2>${escapeHtml(c.name)}</h2>
        <p>@${escapeHtml(c.slug)} · ${Number(c.member_count||0)} members${c.my_role ? ` · ${escapeHtml(String(c.my_role).toUpperCase())}` : ''}</p>
      </div>
    </div>`;
}

async function paintClubDetailTab() {
  const body = $('club-detail-body');
  const c = activeClubDetail;
  if (!c) return;
  const canManage = ['owner','admin'].includes(c.my_role);
  const isOwner = c.my_role === 'owner';

  if (activeClubDetailTab === 'overview') {
    body.innerHTML = `
      <section class="community-section">
        <span class="eyebrow">ABOUT</span>
        <p class="club-about">${escapeHtml(c.description || 'This club has not added a description yet.')}</p>
      </section>
      <div class="community-stat-grid">
        <article><b>${Number(c.member_count||0)}</b><span>Members</span></article>
        <article><b>${Number(c.arena_count||0)}</b><span>Arenas hosted</span></article>
        <article><b>${c.visibility === 'public' ? 'Open' : 'Invite'}</b><span>Membership</span></article>
      </div>
      ${c.my_role ? `<button id="club-leave-button" class="button ghost small">${isOwner ? 'Transfer ownership before leaving' : 'Leave club'}</button>` : ''}`;
    $('club-leave-button')?.addEventListener('click', async () => {
      if (isOwner) return toast('Transfer ownership before leaving this club.');
      if (!confirm(`Leave ${c.name}?`)) return;
      const { error } = await sb.rpc('bozo_leave_club', { target_club_id: c.id });
      if (error) return toast(readableError(error));
      closeClubDetail(); toast('Left club.'); loadWebClubs();
    });
    return;
  }

  if (activeClubDetailTab === 'members') {
    const pending = activeClubMembers.filter(m => m.status !== 'active');
    const active = activeClubMembers.filter(m => m.status === 'active');
    body.innerHTML = `
      ${canManage ? `<section class="community-section club-invite-row">
        <div><span class="eyebrow">INVITE PLAYER</span><h3>Add someone by username</h3></div>
        <div class="inline-form"><input id="club-invite-username" placeholder="@username"><button id="club-invite-button" class="button primary small">Invite</button></div>
      </section>` : ''}
      ${pending.length ? `<section class="community-section"><span class="eyebrow">PENDING</span><div class="community-member-list">${pending.map(m => clubMemberMarkup(m,c)).join('')}</div></section>` : ''}
      <section class="community-section"><span class="eyebrow">MEMBERS</span><div class="community-member-list">${active.map(m => clubMemberMarkup(m,c)).join('')}</div></section>`;

    $('club-invite-button')?.addEventListener('click', async () => {
      const username = $('club-invite-username').value.trim().replace(/^@/,'');
      if (!username) return;
      const { error } = await sb.rpc('bozo_invite_club_member', { target_club_id:c.id, target_username:username });
      if (error) return toast(readableError(error));
      toast('Club invitation sent.');
      await refreshClubMembers();
    });
    bindClubMemberActions();
    return;
  }

  if (activeClubDetailTab === 'arenas') {
    const { data, error } = await sb.rpc('bozo_list_club_arenas', { target_club_id:c.id });
    if (error) return body.innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    const rows = data || [];
    body.innerHTML = rows.length ? `<div class="community-arena-list">${rows.map(a => `
      <article>
        <div><span>${a.is_official ? 'BOZO OFFICIAL' : escapeHtml(a.host_type.toUpperCase())}</span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.time_control)} · ${new Date(a.starts_at).toLocaleString()}</small></div>
        <button class="button secondary small" data-club-arena-open="${a.id}">View</button>
      </article>`).join('')}</div>` :
      '<div class="empty-state"><div>♜</div><b>No club arenas yet</b><span>Club owners and admins can create them from Play → Arenas.</span></div>';
    body.querySelectorAll('[data-club-arena-open]').forEach(b => b.addEventListener('click', () => openArenaDetail(b.dataset.clubArenaOpen)));
    return;
  }

  if (activeClubDetailTab === 'settings') {
    if (!canManage) {
      body.innerHTML = '<div class="empty-state"><div>🔒</div><b>Club management</b><span>Only the club owner and admins can edit club settings.</span></div>';
      return;
    }
    body.innerHTML = `
      <section class="community-section">
        <span class="eyebrow">CLUB SETTINGS</span>
        <label>Name<input id="club-detail-name" maxlength="40" value="${escapeHtml(c.name)}"></label>
        <label>Description<textarea id="club-detail-description" rows="5" maxlength="500">${escapeHtml(c.description||'')}</textarea></label>
        <label>Visibility<select id="club-detail-visibility"><option value="public"${c.visibility==='public'?' selected':''}>Public</option><option value="private"${c.visibility==='private'?' selected':''}>Private / invite or request</option></select></label>
        <button id="club-save-settings" class="button primary">Save club settings</button>
      </section>
      ${isOwner ? `<section class="community-section danger-community-zone">
        <span class="eyebrow">OWNERSHIP</span>
        <h3>Transfer club ownership</h3>
        <p>Enter the username of an active club member. You will become an admin after transfer.</p>
        <div class="inline-form"><input id="club-transfer-username" placeholder="@username"><button id="club-transfer-button" class="button secondary small">Transfer</button></div>
      </section>` : ''}`;

    $('club-save-settings')?.addEventListener('click', async () => {
      const { error } = await sb.rpc('bozo_update_club', {
        target_club_id:c.id,
        club_name:$('club-detail-name').value.trim(),
        club_description:$('club-detail-description').value.trim(),
        club_visibility:$('club-detail-visibility').value
      });
      if (error) return toast(readableError(error));
      toast('Club updated.');
      await openClubDetail(c.id);
    });

    $('club-transfer-button')?.addEventListener('click', async () => {
      const username = $('club-transfer-username').value.trim().replace(/^@/,'');
      if (!username || !confirm(`Transfer ownership of ${c.name} to @${username}?`)) return;
      const { error } = await sb.rpc('bozo_transfer_club_ownership', { target_club_id:c.id, target_username:username });
      if (error) return toast(readableError(error));
      toast('Ownership transferred.');
      await openClubDetail(c.id);
    });
  }
}

function clubMemberMarkup(m,c) {
  const canManage = ['owner','admin'].includes(c.my_role);
  const meOwner = c.my_role === 'owner';
  const targetOwner = m.role === 'owner';
  const targetAdmin = m.role === 'admin';
  return `<article class="community-member-row">
    <div class="member-identity"><img src="${escapeHtml(m.avatar_url || './assets/bozo-mascot.webp')}" alt=""><div><b>${escapeHtml(m.ign || 'Player')}</b><span>@${escapeHtml(m.username || '')} · ${escapeHtml((m.role||'member').toUpperCase())}${m.status!=='active' ? ` · ${escapeHtml(m.status.toUpperCase())}` : ''}</span></div></div>
    ${canManage && !targetOwner ? `<div class="member-actions">
      ${m.status === 'requested' ? `<button class="button primary small" data-member-action="approve" data-member-user="${m.user_id}">Approve</button>` : ''}
      ${m.status === 'invited' ? `<button class="button ghost small" data-member-action="remove" data-member-user="${m.user_id}">Cancel invite</button>` : ''}
      ${m.status === 'active' && meOwner ? `<button class="button secondary small" data-member-action="${targetAdmin?'demote':'promote'}" data-member-user="${m.user_id}">${targetAdmin?'Demote':'Make admin'}</button>` : ''}
      ${m.status === 'active' ? `<button class="button ghost small" data-member-action="remove" data-member-user="${m.user_id}">Remove</button>` : ''}
    </div>` : ''}
  </article>`;
}

async function refreshClubMembers() {
  const { data } = await sb.rpc('bozo_list_club_members', { target_club_id:activeClubDetailId });
  activeClubMembers = data || [];
  await paintClubDetailTab();
}

function bindClubMemberActions() {
  $('club-detail-body').querySelectorAll('[data-member-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.memberAction;
    if ((action === 'remove' || action === 'demote') && !confirm(`${action === 'remove' ? 'Remove' : 'Demote'} this club member?`)) return;
    const { error } = await sb.rpc('bozo_manage_club_member', {
      target_club_id:activeClubDetailId,
      target_user_id:button.dataset.memberUser,
      member_action:action
    });
    if (error) return toast(readableError(error));
    toast('Club membership updated.');
    await refreshClubMembers();
  }));
}

$('create-club-button')?.addEventListener('click', () => {
  $('create-club-modal').hidden = false;
  $('club-create-status').textContent = '';
});
$('close-create-club')?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  $('create-club-modal').hidden = true;
});
$('create-club-modal')?.addEventListener('click', (event) => {
  if (event.target === $('create-club-modal')) $('create-club-modal').hidden = true;
});
$('submit-create-club')?.addEventListener('click', async () => {
  const name = $('club-name-input').value.trim();
  const slug = $('club-slug-input').value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  const description = $('club-description-input').value.trim();
  const visibility = $('club-visibility-input').value;
  if (name.length < 3 || slug.length < 3) return $('club-create-status').textContent = 'Club name and handle need at least 3 characters.';

  let iconUrl = null;
  const iconFile = $('club-icon-file')?.files?.[0] || null;
  if (iconFile) {
    if (iconFile.size > 3 * 1024 * 1024) return $('club-create-status').textContent = 'Club icon must be 3 MB or smaller.';
    const ext = (iconFile.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path = `${state.session.user.id}/${crypto.randomUUID()}.${ext}`;
    const upload = await sb.storage.from('bozo-club-icons').upload(path, iconFile, { upsert:false, contentType:iconFile.type || undefined });
    if (upload.error) return $('club-create-status').textContent = readableError(upload.error);
    iconUrl = sb.storage.from('bozo-club-icons').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await sb.rpc('bozo_create_club', { club_name:name, club_slug:slug, club_description:description, club_visibility:visibility, club_icon_url:iconUrl });
  if (error) return $('club-create-status').textContent = readableError(error);
  $('create-club-modal').hidden = true;
  toast('Club created.');
  socialSection = 'clubs'; clubFilter = 'mine'; paintSocialSection(); await loadWebClubs();
});

$$('[data-friend-filter]').forEach(button => {
  button.addEventListener('click', () => {
    friendFilter = button.dataset.friendFilter;
    $$('[data-friend-filter]').forEach(b => b.classList.toggle('active', b === button));
    paintWebFriends();
  });
});

$('add-web-friend-button').addEventListener('click', () => {
  $('add-web-friend-modal').hidden = false;
  $('web-friend-status').textContent = '';
  $('web-friend-username').value = '';
});
$('close-add-web-friend').addEventListener('click', () => $('add-web-friend-modal').hidden = true);
$('send-web-friend-request').addEventListener('click', sendWebFriendRequest);

async function loadWebFriends() {
  const { data, error } = await sb.rpc('my_friends');
  if (error) {
    $('web-friends-list').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  webFriends = data || [];
  paintWebFriends();
}

function filteredWebFriends() {
  if (friendFilter === 'accepted') return webFriends.filter(f => f.status === 'accepted');
  if (friendFilter === 'incoming') return webFriends.filter(f => f.status === 'pending' && f.direction === 'incoming');
  return webFriends.filter(f => f.status === 'pending' && f.direction === 'outgoing');
}

function paintWebFriends() {
  const rows = filteredWebFriends();
  const target = $('web-friends-list');
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state"><div>👥</div><b>No ${friendFilter} connections</b><span>Add someone by their BOZO username.</span></div>`;
    return;
  }

  target.innerHTML = rows.map(friend => `
    <article class="friend-card">
      <img src="${escapeHtml(friend.avatar_url || './assets/bozo-mascot.webp')}" alt="">
      <div class="friend-card-copy">
        <span>${escapeHtml(friend.opening_personality || 'Player')}</span>
        <h3>${escapeHtml(friend.ign || 'Player')}</h3>
        <p>@${escapeHtml(friend.username)}</p>
        ${friend.bio ? `<small>${escapeHtml(friend.bio)}</small>` : ''}
      </div>
      <div class="friend-card-actions">
        ${friend.status === 'accepted' ? `
          <button class="button primary" onclick="openFriendProfile('${escapeHtml(friend.username).replace(/'/g,"\'")}')">View profile</button>
          <button class="button secondary" onclick="challengeWebFriend('${escapeHtml(friend.username).replace(/'/g,"\'")}')">Challenge</button>
          <button class="button secondary" onclick="removeWebFriend('${friend.friendship_id}')">Remove</button>
        ` : friend.direction === 'incoming' ? `
          <button class="button primary" onclick="respondWebFriend('${friend.friendship_id}',true)">Accept</button>
          <button class="button secondary" onclick="respondWebFriend('${friend.friendship_id}',false)">Decline</button>
        ` : `<span class="friend-pending">Request sent</span>`}
      </div>
    </article>
  `).join('');
}

async function sendWebFriendRequest() {
  const username = $('web-friend-username').value.trim();
  if (!username) return $('web-friend-status').textContent = 'Enter a username.';
  $('web-friend-status').textContent = 'Sending…';
  const { error } = await sb.rpc('send_friend_request', { target_username: username });
  if (error) return $('web-friend-status').textContent = readableError(error);
  $('add-web-friend-modal').hidden = true;
  toast('Friend request sent');
  friendFilter = 'outgoing';
  await loadWebFriends();
}

async function respondWebFriend(id, accept) {
  const { error } = await sb.rpc('respond_friend_request', {
    friendship_id: id,
    accept_request: accept
  });
  if (error) return toast(readableError(error));
  if (accept) await logActivity('friend_added', {});
  toast(accept ? 'Friend added' : 'Request declined');
  await loadWebFriends();
}

async function removeWebFriend(id) {
  if (!confirm('Remove this friend?')) return;
  const { error } = await sb.rpc('remove_friend', { friendship_id: id });
  if (error) return toast(readableError(error));
  toast('Friend removed');
  await loadWebFriends();
}

function challengeWebFriend(username) {
  route('challenges');
  setTimeout(() => {
    $('new-challenge-button').click();
    $('duel-opponent').value = '@' + username;
  }, 80);
}

async function openFriendProfile(username) {
  const friend = webFriends.find(item => item.username === username && item.status === 'accepted');
  if (!friend) return toast('That friend profile could not be loaded.');

  const modal = $('friend-profile-modal');
  modal.hidden = false;
  setFriendProfileTab('overview');
  modal.querySelector('.friend-profile-modal')?.classList.add('friend-profile-loading');

  $('friend-profile-avatar').src = friend.avatar_url || './assets/bozo-mascot.webp';
  $('friend-profile-avatar').onerror = () => { $('friend-profile-avatar').src = './assets/bozo-mascot.webp'; };
  $('friend-profile-personality').textContent = friend.opening_personality || 'Player';
  $('friend-profile-ign').textContent = friend.ign || 'Player';
  $('friend-profile-username').textContent = '@' + (friend.username || 'username');
  $('friend-profile-supporter').hidden = true;
  $('friend-profile-ign').style.color = '';
  applyProfileCosmetics(document.querySelector('.friend-profile-hero'), null);
  $('friend-profile-bio').textContent = friend.bio?.trim() || 'This player has not added a bio yet.';
  $('friend-profile-white-opening').textContent = 'Loading…';
  $('friend-profile-black-e4-opening').textContent = 'Loading…';
  $('friend-profile-black-d4-opening').textContent = 'Loading…';
  $('friend-profile-challenge').dataset.username = friend.username || '';
  $('friend-profile-openings-studied').textContent = ' - ';
  $('friend-profile-reviews').textContent = ' - ';
  $('friend-profile-suggestions').textContent = ' - ';
  $('friend-profile-member-since').textContent = ' - ';
  $('friend-profile-activity').innerHTML = '<div class="empty-state mini"><span>Loading activity…</span></div>';
  $('friend-profile-rating-grid').innerHTML = '<div class="empty-state mini"><span>Loading ratings…</span></div>';
  $('friend-profile-game-history').innerHTML = '<div class="empty-state mini"><span>Loading games…</span></div>';

  const [{ data, error }, { data: socialData, error: socialError }, chessResult, cosmeticsResult] = await Promise.all([
    sb.rpc('get_friend_profile', { target_username: username }),
    sb.rpc('get_friend_activity_summary', { target_username: username }),
    loadChessProfile(username).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
    getPublicCosmetics(username).then(data => ({data,error:null})).catch(error => ({data:null,error}))
  ]);
  const profile = Array.isArray(data) ? data[0] : data;
  if (error) {
    console.warn('Could not load extended friend profile:', error);
    $('friend-profile-white-opening').textContent = friend.favorite_white_opening || 'Not selected';
    $('friend-profile-black-e4-opening').textContent = friend.favorite_black_e4_opening || 'Not selected';
    $('friend-profile-black-d4-opening').textContent = friend.favorite_black_d4_opening || 'Not selected';
  } else {
    const detail = profile || {};
    $('friend-profile-avatar').src = detail.avatar_url || friend.avatar_url || './assets/bozo-mascot.webp';
    $('friend-profile-personality').textContent = detail.opening_personality || friend.opening_personality || 'Player';
    $('friend-profile-ign').textContent = detail.ign || friend.ign || 'Player';
    $('friend-profile-username').textContent = '@' + (detail.username || friend.username || 'username');
    $('friend-profile-bio').textContent = detail.bio?.trim() || friend.bio?.trim() || 'This player has not added a bio yet.';
    $('friend-profile-white-opening').textContent = detail.favorite_white_opening || 'Not selected';
    $('friend-profile-black-e4-opening').textContent = detail.favorite_black_e4_opening || 'Not selected';
    $('friend-profile-black-d4-opening').textContent = detail.favorite_black_d4_opening || 'Not selected';
  }
  const cosmetics = cosmeticsResult?.data;
  if (cosmetics) {
    $('friend-profile-supporter').hidden = !cosmetics.is_supporter;
    $('friend-profile-ign').style.color = cosmetics.is_supporter ? validBozoNameColor(cosmetics.name_color) : '';
    applyProfileCosmetics(document.querySelector('.friend-profile-hero'), cosmetics);
  }

  if (socialError) {
    console.warn('Could not load friend activity summary:', socialError);
    $('friend-profile-activity').innerHTML = '<div class="empty-state mini"><span>Stats unavailable until the BOZO 2.7 migration is installed.</span></div>';
  } else {
    const social = Array.isArray(socialData) ? socialData[0] : socialData;
    $('friend-profile-openings-studied').textContent = Number(social?.openings_studied || 0).toLocaleString();
    $('friend-profile-reviews').textContent = Number(social?.games_reviewed || 0).toLocaleString();
    $('friend-profile-suggestions').textContent = Number(social?.accepted_suggestions || 0).toLocaleString();
    const memberSinceValue = social?.member_since || profile?.created_at || friend?.created_at;
    const memberSinceDate = memberSinceValue ? new Date(memberSinceValue) : null;
    $('friend-profile-member-since').textContent = memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : ' - ';
    $('friend-profile-activity').innerHTML = activityMarkup(social?.recent_activity || [], 'This player has not shared any recent BOZO activity.');
  }

  if (chessResult?.error) {
    console.warn('Could not load friend chess profile:', chessResult.error);
    $('friend-profile-rating-grid').innerHTML = `<div class="empty-state mini"><b>Ratings unavailable</b><span>${escapeHtml(readableError(chessResult.error))}</span></div>`;
    $('friend-profile-game-history').innerHTML = `<div class="empty-state mini"><b>Games unavailable</b><span>${escapeHtml(readableError(chessResult.error))}</span></div>`;
    friendChessProfile = { ratings: [], games: [] };
  } else {
    friendChessProfile = chessResult?.data || { ratings: [], games: [] };
    $('friend-profile-rating-grid').innerHTML = ratingGridMarkup(friendChessProfile.ratings);
    $('friend-profile-game-history').innerHTML = gameHistoryMarkup(friendChessProfile.games, null, 'This player has no completed rated games yet.');
  }

  modal.querySelector('.friend-profile-modal')?.classList.remove('friend-profile-loading');
  refreshFriendSpectateButton(username);
}

function closeFriendProfile() {
  $('friend-profile-modal').hidden = true;
}

$('close-friend-profile')?.addEventListener('click', closeFriendProfile);
$('friend-profile-close-button')?.addEventListener('click', closeFriendProfile);
$('friend-profile-spectate')?.addEventListener('click', async event => {
  const matchId=event.currentTarget.dataset.matchId;
  if(matchId)await openSpectatorMatch(matchId);
});
$('friend-profile-modal')?.addEventListener('click', event => {
  if (event.target.id === 'friend-profile-modal') closeFriendProfile();
});
$('friend-profile-challenge')?.addEventListener('click', () => {
  const username = $('friend-profile-challenge').dataset.username;
  closeFriendProfile();
  if (username) challengeWebFriend(username);
});


function groupMovesByTurn(moves = []) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      turn: Math.floor(index / 2) + 1,
      white: moves[index] || '',
      black: moves[index + 1] || ''
    });
  }
  return rows;
}


function duelMoveSan(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';

  return String(
    entry.san ??
    entry.move_san ??
    entry.move ??
    entry.notation ??
    ''
  );
}

function normalizeDuelMoveHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.map(duelMoveSan).filter(Boolean);
}

function duelStateSignature(duel) {
  if (!duel) return '';
  return JSON.stringify({
    status: duel.status,
    turn_user_id: duel.turn_user_id,
    result: duel.result,
    resulting_fen: duel.resulting_fen || duel.current_fen || duel.fen || '',
    moves: normalizeDuelMoveHistory(duel.move_history),
    white_time_ms: duel.white_time_ms,
    black_time_ms: duel.black_time_ms,
    clock_started_at: duel.clock_started_at,
    draw_offer_by: duel.draw_offer_by,
    draw_offer_at: duel.draw_offer_at
  });
}


function renderDuelMoveRows(moves = []) {
  const normalizedMoves = normalizeDuelMoveHistory(moves);
  return groupMovesByTurn(normalizedMoves).map(row => `
    <div class="grouped-move-row duel-history-row">
      <span class="move-number">${row.turn}.</span>
      <span>${escapeHtml(row.white)}</span>
      <span>${escapeHtml(row.black)}</span>
    </div>
  `).join('');
}

function renderGroupedMoveRows(moves = [], currentPly = moves.length) {
  return groupMovesByTurn(moves).map(row => {
    const whitePly = (row.turn - 1) * 2 + 1;
    const blackPly = whitePly + 1;
    return `
      <div class="grouped-move-row">
        <span class="move-number">${row.turn}.</span>
        <button class="${whitePly <= currentPly ? 'played' : ''} ${whitePly === currentPly ? 'current' : ''}"
                onclick="setStudyPly(${whitePly})">${escapeHtml(row.white)}</button>
        <button class="${row.black && blackPly <= currentPly ? 'played' : ''} ${blackPly === currentPly ? 'current' : ''}"
                ${row.black ? `onclick="setStudyPly(${blackPly})"` : 'disabled'}>${escapeHtml(row.black)}</button>
      </div>
    `;
  }).join('');
}

let studyOpening = null;
let studySideOverride = null;
let studyGame = null;
let studyMoves = [];
let studyPly = 0;
let studyOrientation = 'white';

$('close-study-modal').addEventListener('click', closeStudy);
$('study-start').addEventListener('click', () => setStudyPly(0));
$('study-prev').addEventListener('click', () => setStudyPly(studyPly - 1));
$('study-next').addEventListener('click', () => setStudyPly(studyPly + 1));
$('study-end').addEventListener('click', () => setStudyPly(studyMoves.length));
$('study-flip').addEventListener('click', () => {
  studyOrientation = studyOrientation === 'white' ? 'black' : 'white';
  paintStudy();
  if (lastCoachExplanation) {
    drawCoachAnnotations(
      lastCoachExplanation.arrows || [],
      lastCoachExplanation.highlights || []
    );
  }
});

$('ask-coach-button').addEventListener('click', askCurrentStudyMove);
$('clear-coach-button').addEventListener('click', clearCoach);
$('coach-question').addEventListener('keydown', event => {
  if (event.key === 'Enter') askCurrentStudyMove();
});

function matchingBozoOpeningDefinition(opening) {
  if (!opening) return null;
  return BOZO_CLOUD_OPENINGS.find(item =>
    item.eco === opening.eco &&
    item.name === opening.name &&
    (item.variation || 'Main Line') === (opening.variation || 'Main Line')
  ) || null;
}

function studyRepertoireSide() {
  if (studySideOverride === 'white') return 'White';
  if (studySideOverride === 'black') return 'Black';
  if (!studyOpening) return 'Neutral';
  const definition = matchingBozoOpeningDefinition(studyOpening);
  const raw = definition?.repertoire_side
    || studyOpening?.metadata?.repertoire_side
    || studyOpening?.metadata?.repertoireSide
    || studyOpening?.metadata?.side
    || '';
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'white' || normalized === 'w') return 'White';
  if (normalized === 'black' || normalized === 'b') return 'Black';
  return 'Neutral';
}

function studyMoveSide(ply = studyPly) {
  if (!ply) return 'Neutral';
  return ply % 2 === 1 ? 'White' : 'Black';
}

function studyAuthorExplanation(ply = studyPly) {
  if (!studyOpening || !ply) return '';
  const definition = matchingBozoOpeningDefinition(studyOpening);
  const explanations = definition?.author_explanations || studyOpening?.metadata?.author_explanations || {};
  return explanations?.[String(ply)] || explanations?.[ply] || '';
}

function updateStudyAuthorExplanation() {
  const panel = document.getElementById('study-author-explanation');
  const text = document.getElementById('study-author-explanation-text');
  const move = document.getElementById('study-author-explanation-move');
  if (!panel || !text || !move) return;

  const explanation = studyAuthorExplanation();
  if (!studyPly || !explanation) {
    panel.hidden = true;
    text.textContent = '';
    move.textContent = '';
    return;
  }

  const san = studyMoves[studyPly - 1] || '';
  move.textContent = `${Math.ceil(studyPly / 2)}${studyPly % 2 ? '.' : '...'} ${san}`;
  text.textContent = explanation;
  panel.hidden = false;
}

async function openStudyOpening(openingId, options = {}) {
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,notes,metadata')
    .eq('id', openingId)
    .maybeSingle();

  if (error || !data) return toast(readableError(error || new Error('Opening not found')));

  studyOpening = data;
  studySideOverride = ['white','black'].includes(String(options.repertoireSide || '').toLowerCase())
    ? String(options.repertoireSide).toLowerCase()
    : null;
  window.BozoMastery?.startSession?.(data, 0);
  studyGame = new Chess();
  const parser = new Chess();
  const loaded = parser.load_pgn(data.pgn, { sloppy: true });
  if (!loaded) return toast('This line could not be loaded on the study board.');

  studyMoves = parser.history();
  studyPly = 0;
  studyOrientation = ['white','black'].includes(String(options.orientation || '').toLowerCase())
    ? String(options.orientation).toLowerCase()
    : (studySideOverride || 'white');
  $('study-title').textContent = data.name;
  $('study-subtitle').textContent = `${data.variation || 'Main Line'} · ${data.eco || 'ECO  - '}`;
  $('study-pgn').textContent = data.pgn;
  $('study-modal').hidden = false;
  clearCoach();
  updateStudyAuthorExplanation();
  paintStudy();
  requestAnimationFrame(() => paintStudy());
  setTimeout(() => paintStudy(), 80);
}

function closeStudy() {
  $('study-modal').hidden = true;
  studySideOverride = null;
}

function setStudyPly(nextPly) {
  const previousStudyPly = studyPly;
  studyPly = Math.max(0, Math.min(studyMoves.length, nextPly));
  window.BozoMastery?.recordStudyPly?.(studyOpening, studyPly, studyMoves.length, previousStudyPly);
  if (studyOpening && studyMoves.length && studyPly === studyMoves.length && previousStudyPly < studyMoves.length) {
    logActivity('opening_studied', { opening_id: studyOpening.id, opening: studyOpening.name, variation: studyOpening.variation || 'Main Line' });
  }
  studyGame = new Chess();
  for (let i = 0; i < studyPly; i++) {
    studyGame.move(studyMoves[i], { sloppy: true });
  }
  clearCoachAnnotations();
  updateCoachMoveLabel();
  updateStudyAuthorExplanation();
  paintStudy();
}

function paintStudy() {
  const boardElement = document.getElementById('study-board');
  if (!boardElement) {
    console.error('Opening Library study board element is missing.');
    return;
  }

  if (!studyGame) {
    studyGame = new Chess();
  }

  try {
    const orientation = studyOrientation === 'black' ? 'black' : 'white';
    const boardMatrix = studyGame.board();
    // chess.js board()[0] is rank 8 and board()[7] is rank 1.
    // White therefore reads the matrix in its native order; Black reverses it.
    const rankIndexes = orientation === 'white'
      ? [0,1,2,3,4,5,6,7]
      : [7,6,5,4,3,2,1,0];
    const fileIndexes = orientation === 'white'
      ? [0,1,2,3,4,5,6,7]
      : [7,6,5,4,3,2,1,0];

    const fragment = document.createDocumentFragment();

    for (const rowIndex of rankIndexes) {
      for (const columnIndex of fileIndexes) {
        const piece = boardMatrix[rowIndex][columnIndex];
        const square = document.createElement('div');
        square.className = 'opening-study-square';
        square.dataset.square = `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`;

        if (piece) {
          const color = piece.color === 'w' ? 'white' : 'black';
          square.dataset.pieceColor = color;
          const pieceId = `${piece.color}${piece.type.toUpperCase()}`;
          square.innerHTML = webPiece(pieceId);
        }

        fragment.appendChild(square);
      }
    }

    boardElement.replaceChildren(fragment);
    syncBoardUserAnnotationPosition('study-board', `${studyGame.fen()}|${studyOrientation}`);

    const progress = document.getElementById('study-progress');
    if (progress) {
      progress.textContent = studyPly === 0
        ? 'Start position'
        : `${studyPly}/${studyMoves.length} plies`;
    }

    const moveList = document.getElementById('study-move-list');
    if (moveList) moveList.innerHTML = renderGroupedMoveRows(studyMoves, studyPly);

    const previous = document.getElementById('study-prev');
    const startButton = document.getElementById('study-start');
    const next = document.getElementById('study-next');
    const endButton = document.getElementById('study-end');
    if (previous) previous.disabled = studyPly === 0;
    if (startButton) startButton.disabled = studyPly === 0;
    if (next) next.disabled = studyPly === studyMoves.length;
    if (endButton) endButton.disabled = studyPly === studyMoves.length;

    updateCoachMoveLabel();
    window.BozoMastery?.paintStudyPanel?.(studyOpening, studyPly, studyMoves.length);
  } catch (error) {
    console.error('Opening Library study board render failed:', error);
    boardElement.innerHTML =
      '<div class="study-board-error">The position could not be rendered. Open the browser console and send the red error shown there.</div>';
  }
}


let lastCoachExplanation = null;

const COACH_PIECE_NAMES = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };

function parseFenBoard(fen) {
  const board = {};
  const ranks = String(fen || '').split(' ')[0].split('/');
  ranks.forEach((rank, rankIndex) => {
    let file = 0;
    for (const token of rank) {
      if (/\d/.test(token)) { file += Number(token); continue; }
      const square = `${'abcdefgh'[file]}${8-rankIndex}`;
      board[square] = { type: token.toLowerCase(), color: token === token.toUpperCase() ? 'w' : 'b' };
      file += 1;
    }
  });
  return board;
}

function squareCoords(square) { return ['abcdefgh'.indexOf(square[0]), Number(square[1]) - 1]; }
function coordsSquare(file, rank) { return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? `${'abcdefgh'[file]}${rank+1}` : null; }

function attackedSquaresForPiece(square, piece, board) {
  const [file, rank] = squareCoords(square);
  const out = [];
  const add = (f,r) => { const sq = coordsSquare(f,r); if (sq) out.push(sq); };
  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1;
    add(file-1, rank+direction); add(file+1, rank+direction);
  } else if (piece.type === 'n') {
    [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([df,dr]) => add(file+df,rank+dr));
  } else if (piece.type === 'k') {
    for (let df=-1; df<=1; df++) for (let dr=-1; dr<=1; dr++) if (df || dr) add(file+df,rank+dr);
  } else {
    const directions = piece.type === 'b' ? [[1,1],[1,-1],[-1,1],[-1,-1]]
      : piece.type === 'r' ? [[1,0],[-1,0],[0,1],[0,-1]]
      : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    directions.forEach(([df,dr]) => {
      let f=file+df, r=rank+dr;
      while (coordsSquare(f,r)) {
        const sq=coordsSquare(f,r); out.push(sq);
        if (board[sq]) break;
        f+=df; r+=dr;
      }
    });
  }
  return out;
}

function verifiedCoachFacts(fen, previousFen, playedMove) {
  try {
  const board = parseFenBoard(fen);
  const attacked = { w: [], b: [] };
  Object.entries(board).forEach(([from, piece]) => {
    attackedSquaresForPiece(from, piece, board).forEach(to => {
      const target = board[to];
      if (target && target.color !== piece.color) {
        attacked[target.color].push({
          attacker: `${piece.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[piece.type]} on ${from}`,
          target: `${target.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[target.type]} on ${to}`
        });
      }
    });
  });
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose:true });
  const captures = legalMoves.filter(move => move.flags?.includes('c') || move.flags?.includes('e')).map(move => `${move.san} captures on ${move.to}`);
  const sideToMove = String(fen || '').split(' ')[1] === 'b' ? 'Black' : 'White';

  // Build an explicit, machine-checkable inventory of the CURRENT board. This is
  // deliberately redundant with FEN: the edge function receives both so it does
  // not have to "remember" where a piece used to be several moves ago.
  const pieceMap = Object.entries(board).reduce((acc, [square, piece]) => {
    acc[square] = `${piece.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[piece.type]}`;
    return acc;
  }, {});
  const whitePieces = Object.entries(pieceMap).filter(([,label]) => label.startsWith('White')).map(([sq,label]) => `${label} on ${sq}`);
  const blackPieces = Object.entries(pieceMap).filter(([,label]) => label.startsWith('Black')).map(([sq,label]) => `${label} on ${sq}`);
  const boardStateText = [...whitePieces, ...blackPieces].join('; ');

  // Verify what the selected move ACTUALLY did by replaying it from previousFen.
  // This gives the coach exact from/to/capture information instead of asking the
  // model to infer it from notation and history.
  let moveFacts = null;
  try {
    if (previousFen && playedMove) {
      const before = new Chess(previousFen);
      const verbose = before.move(playedMove, { sloppy: true });
      if (verbose) {
        moveFacts = {
          san: verbose.san || playedMove,
          color: verbose.color === 'w' ? 'White' : 'Black',
          piece: COACH_PIECE_NAMES[verbose.piece] || verbose.piece,
          pieceCode: verbose.piece,
          from: verbose.from,
          to: verbose.to,
          captured: verbose.captured ? (COACH_PIECE_NAMES[verbose.captured] || verbose.captured) : null,
          capturedCode: verbose.captured || null,
          promotion: verbose.promotion ? (COACH_PIECE_NAMES[verbose.promotion] || verbose.promotion) : null,
          promotionCode: verbose.promotion || null,
          isCapture: Boolean(verbose.captured),
          isCastle: /O-O/.test(verbose.san || playedMove),
          isCheck: /[+#]$/.test(verbose.san || playedMove),
          resultingFen: before.fen()
        };
      }
    }
  } catch (moveError) {
    console.warn('Could not verify selected coach move:', moveError);
  }

  return {
    playedMove: playedMove || '',
    sideToMove,
    inCheck: typeof game.in_check === 'function' ? game.in_check() : false,
    legalCaptureCount: captures.length,
    legalCaptures: captures.slice(0, 20),
    attackedWhitePieces: attacked.w.map(item => item.target),
    attackedBlackPieces: attacked.b.map(item => item.target),
    attackRelations: [...attacked.w, ...attacked.b].slice(0, 40),
    pieceMap,
    whitePieces,
    blackPieces,
    boardStateText,
    moveFacts,
    currentFen: fen || '',
    groundingRules: [
      'Treat currentFen and pieceMap as the source of truth for the CURRENT position.',
      'Never describe a piece as being on a square unless pieceMap contains that exact piece and square.',
      'Do not refer to a pawn by an old square from moveHistory. For example, if a pawn moved g4-g5, it is now the g5 pawn, not the g4 pawn.',
      'Use moveFacts as the source of truth for what the selected move moved, captured, or castled.',
      'Only state that a piece is attacked, pinned, trapped, forked, hanging, or won when the verified facts explicitly support it.',
      'Do not infer an immediate attack from a generic opening idea.',
      'When tactical verification is absent, explain development, central control, king safety, pawn structure, or long-term plans instead.',
      'Use cautious language for plans and future possibilities.'
    ],
    previousFen: previousFen || ''
  };
  } catch (error) {
    console.warn('Could not calculate verified coach facts:', error);
    return { playedMove: playedMove || '', sideToMove: '', inCheck:false, legalCaptureCount:0, legalCaptures:[], attackedWhitePieces:[], attackedBlackPieces:[], attackRelations:[], pieceMap:{}, whitePieces:[], blackPieces:[], boardStateText:'', moveFacts:null, currentFen:fen || '', groundingRules:['Do not make tactical claims unless directly verified from the board.'], previousFen: previousFen || '' };
  }
}


function reviewVerifiedTeachingFacts(row, selectedIndex) {
  const base = verifiedCoachFacts(row.fen, row.previousFen, row.san);
  try {
    const beforeBoard = parseFenBoard(row.previousFen);
    const afterBoard = parseFenBoard(row.fen);
    const move = base.moveFacts || {};
    const changedSquares = [];

    const allSquares = new Set([...Object.keys(beforeBoard), ...Object.keys(afterBoard)]);
    allSquares.forEach(square => {
      const before = beforeBoard[square];
      const after = afterBoard[square];
      const beforeLabel = before ? `${before.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[before.type]}` : 'empty';
      const afterLabel = after ? `${after.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[after.type]}` : 'empty';
      if (beforeLabel !== afterLabel) changedSquares.push({ square, before: beforeLabel, after: afterLabel });
    });

    const movedPiece = move.to && afterBoard[move.to] ? afterBoard[move.to] : null;
    const movedPieceAttacks = movedPiece
      ? attackedSquaresForPiece(move.to, movedPiece, afterBoard)
      : [];

    // What lines became available because the origin square was vacated?
    const newlyOpenedFromOrigin = [];
    if (move.from) {
      Object.entries(afterBoard).forEach(([square, piece]) => {
        if (!['b','r','q'].includes(piece.type)) return;
        const afterAttacks = attackedSquaresForPiece(square, piece, afterBoard);
        const beforePiece = beforeBoard[square];
        const beforeAttacks = beforePiece ? attackedSquaresForPiece(square, beforePiece, beforeBoard) : [];
        afterAttacks.filter(sq => !beforeAttacks.includes(sq)).forEach(sq => {
          newlyOpenedFromOrigin.push(`${piece.color === 'w' ? 'White' : 'Black'} ${COACH_PIECE_NAMES[piece.type]} on ${square} newly reaches ${sq}`);
        });
      });
    }

    const nextMoves = reviewData?.rows?.slice(selectedIndex + 1, selectedIndex + 5).map(r => r.san) || [];
    const previousMoves = reviewData?.rows?.slice(Math.max(0, selectedIndex - 3), selectedIndex).map(r => r.san) || [];

    // Explicitly verify whether common follow-up moves are legal from the resulting position.
    const afterGame = new Chess(row.fen);
    const legalSan = afterGame.moves();
    const legalFollowUps = legalSan.slice(0, 80);

    return {
      ...base,
      beforeFen: row.previousFen,
      afterFen: row.fen,
      changedSquares,
      beforePieces: beforeBoard,
      afterPieces: afterBoard,
      movedPieceAttacks,
      newlyOpenedLines: newlyOpenedFromOrigin.slice(0, 30),
      previousMoves,
      actualNextMoves: nextMoves,
      legalFollowUps,
      factualTeachingRules: [
        'Every concrete square, piece-location, attack, weakness, opened line, capture, or threat claim must be supported by these verified facts.',
        'Do NOT invent weak or loosened squares. A pawn move does not automatically make nearby squares weak.',
        'Do NOT claim that a square became weak merely because a pawn moved unless the supplied before/after facts explicitly establish that idea.',
        'For opening plans, distinguish verified current facts from future plans. Say "prepares" or "aims to" only when the follow-up is legal or appears in the actual continuation/authored knowledge.',
        'If a strategic claim cannot be verified, omit it rather than filling space with chess-sounding language.',
        'Use actualNextMoves to connect a move to what happened next in this game.',
        'Use movedPieceAttacks only for attacks created by the moved piece in the resulting position.',
        'Use newlyOpenedLines only for lines that the board comparison actually shows became newly available.'
      ]
    };
  } catch (error) {
    return base;
  }
}

function reviewTeachingText(explanation) {
  if (!explanation || typeof explanation !== 'object') return '';
  const values = [];
  const walk = value => {
    if (typeof value === 'string') values.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(explanation);
  return values.join(' ');
}


function reviewSquareAttackedByMovedPiece(square, facts) {
  return Boolean(square && (facts?.movedPieceAttacks || []).includes(square));
}

function reviewTeachingHasUnsupportedRelationship(explanation, facts) {
  const text = reviewTeachingText(explanation);
  if (!text) return false;

  // Claims such as "...g6 supports the knight on f6" must be geometrically true.
  const relation = /\b(?:supports?|protects?|defends?|guards?)\s+(?:(?:white|black)(?:'s)?\s+)?(?:pawn|knight|bishop|rook|queen|king|piece)\s+(?:on\s+)?([a-h][1-8])\b/ig;
  let match;
  while ((match = relation.exec(text))) {
    if (!reviewSquareAttackedByMovedPiece(match[1].toLowerCase(), facts)) return true;
  }

  const squareClaim = /\b(?:controls?|contests?|attacks?|pressures?|eyes|targets?)\s+(?:the\s+)?(?:square\s+)?([a-h][1-8])\b/ig;
  while ((match = squareClaim.exec(text))) {
    const sq = match[1].toLowerCase();
    const supported =
      reviewSquareAttackedByMovedPiece(sq, facts) ||
      (facts?.newlyOpenedLines || []).some(line => line.endsWith(` ${sq}`));
    if (!supported) return true;
  }

  if (/\b(?:contests?|controls?|opens?|uses?|pressures?)\s+(?:the\s+)?(?:long\s+)?(?:diagonal|file|rank)\b/i.test(text)) {
    if (!(facts?.newlyOpenedLines || []).length) return true;
  }
  return false;
}

function reviewTeachingHasUnsupportedStrategicClaim(explanation, facts) {
  const text = reviewTeachingText(explanation);
  if (!text) return false;

  // These claims require special evidence. Until BOZO has a dedicated square-
  // weakness evaluator, rejecting them is safer than hallucinating them.
  if (/\b(?:weakens?|weakened|weak square|weak squares|loosens?|loosened|creates? a hole|holes on|vulnerable square)\b/i.test(text)) {
    return true;
  }

  if (
    textClaimsImpossibleBoardReference(text, facts) ||
    textClaimsUnsupportedAttack(text, facts) ||
    reviewTeachingHasUnsupportedRelationship(explanation, facts)
  ) {
    return true;
  }

  return false;
}

function textClaimsUnsupportedAttack(text, facts) {
  if (!text || !/attack(?:s|ed|ing)?|threaten(?:s|ed|ing)?|fork(?:s|ed|ing)?|pin(?:s|ned|ning)?|hang(?:s|ing)?/i.test(text)) return false;
  const whiteTargets = (facts.attackedWhitePieces || []).join(' ').toLowerCase();
  const blackTargets = (facts.attackedBlackPieces || []).join(' ').toLowerCase();
  const checks = [
    [/white(?:'s)?\s+bishop|white bishop/i, whiteTargets.includes('white bishop')],
    [/black(?:'s)?\s+bishop|black bishop/i, blackTargets.includes('black bishop')],
    [/white(?:'s)?\s+knight|white knight/i, whiteTargets.includes('white knight')],
    [/black(?:'s)?\s+knight|black knight/i, blackTargets.includes('black knight')],
    [/white(?:'s)?\s+queen|white queen/i, whiteTargets.includes('white queen')],
    [/black(?:'s)?\s+queen|black queen/i, blackTargets.includes('black queen')],
    [/white(?:'s)?\s+rook|white rook/i, whiteTargets.includes('white rook')],
    [/black(?:'s)?\s+rook|black rook/i, blackTargets.includes('black rook')]
  ];
  return checks.some(([pattern, supported]) => pattern.test(text) && !supported);
}

function textClaimsImpossibleBoardReference(text, facts) {
  if (!text || !facts?.pieceMap) return false;
  const pieceMap = facts.pieceMap || {};
  const lower = String(text).toLowerCase();

  // Catch explicit current-square claims. Curly apostrophes and optional hyphens
  // are supported because model prose often varies typographically.
  const patterns = [
    /\b(white|black)(?:['’]s)?\s+([a-h][1-8])[-\s]+(pawn|knight|bishop|rook|queen|king)\b/gi,
    /\b(white|black)(?:['’]s)?\s+(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi,
    /\bthe\s+(white|black)\s+(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi
  ];

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    let match;
    while ((match = pattern.exec(lower))) {
      let color, square, piece;
      if (index === 0) { color = match[1]; square = match[2]; piece = match[3]; }
      else { color = match[1]; piece = match[2]; square = match[3]; }
      const expected = `${color === 'white' ? 'White' : 'Black'} ${piece}`;
      if (pieceMap[square] !== expected) return true;
    }
  }

  // Catch colorless forms such as "g4 pawn", "g4-pawn", or "pawn on g4".
  const squarePiece = /\b([a-h][1-8])[-\s]+(pawn|knight|bishop|rook|queen|king)\b/gi;
  let match;
  while ((match = squarePiece.exec(lower))) {
    const [, square, piece] = match;
    const actual = pieceMap[square];
    if (!actual || !actual.toLowerCase().endsWith(` ${piece}`)) return true;
  }

  const pieceOnSquare = /\b(pawn|knight|bishop|rook|queen|king)\s+(?:on|at)\s+([a-h][1-8])\b/gi;
  while ((match = pieceOnSquare.exec(lower))) {
    const [, piece, square] = match;
    const actual = pieceMap[square];
    if (!actual || !actual.toLowerCase().endsWith(` ${piece}`)) return true;
  }

  return false;
}

function coachSentenceIsGrounded(text, facts) {
  return !textClaimsImpossibleBoardReference(text, facts) && !textClaimsUnsupportedAttack(text, facts);
}

function sanitizeCoachExplanation(explanation, facts) {
  if (!explanation || typeof explanation !== 'object') return explanation;
  const cleanText = value => {
    if (typeof value !== 'string') return value;
    const sentences = value
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => coachSentenceIsGrounded(sentence, facts));
    return sentences.join(' ').trim();
  };
  const output = Array.isArray(explanation) ? explanation.map(item => typeof item === 'string' ? cleanText(item) : sanitizeCoachExplanation(item, facts)) : {};
  if (!Array.isArray(explanation)) Object.entries(explanation).forEach(([key,value]) => {
    output[key] = typeof value === 'string' ? cleanText(value)
      : Array.isArray(value) ? value.map(item => typeof item === 'string' ? cleanText(item) : sanitizeCoachExplanation(item, facts))
      : value && typeof value === 'object' ? sanitizeCoachExplanation(value, facts) : value;
  });
  output.groundingVerified = true;
  return output;
}

function updateCoachMoveLabel() {
  const label = $('coach-move-label');
  if (!label) return;
  label.textContent = studyPly > 0
    ? `${Math.ceil(studyPly / 2)}${studyPly % 2 ? '.' : '...'} ${studyMoves[studyPly - 1]}`
    : 'Choose a move';
}

function clearCoachAnnotations() {
  const svg = $('study-arrow-layer');
  if (svg) svg.innerHTML = '';
  lastCoachExplanation = null;
}

function clearCoach() {
  clearCoachAnnotations();
  const answer = $('coach-answer');
  const question = $('coach-question');
  if (answer) {
    answer.innerHTML =
      'Select a move in the line, then ask BOZO Coach why it is played.';
  }
  if (question) question.value = '';
  updateCoachMoveLabel();
}

async function askCurrentStudyMove() {
  const answer = $('coach-answer');
  const button = $('ask-coach-button');

  if (!state.session?.user) {
    answer.textContent = 'Sign in before using BOZO Coach.';
    return;
  }

  if (!studyOpening || !studyGame || studyPly === 0) {
    answer.textContent = 'Choose a move from the move list first.';
    return;
  }

  const replayBefore = new Chess();
  for (let index = 0; index < studyPly - 1; index++) {
    replayBefore.move(studyMoves[index], { sloppy: true });
  }

  const question = $('coach-question').value.trim();
  const playedMove = studyMoves[studyPly - 1];
  const coachFacts = verifiedCoachFacts(studyGame.fen(), replayBefore.fen(), playedMove);

  button.disabled = true;
  button.textContent = 'BOZO Coach is thinking…';
  answer.innerHTML = '<div class="coach-thinking">Analyzing the position and opening idea…</div>';
  clearCoachAnnotations();

  try {
    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        fen: studyGame.fen(),
        previousFen: replayBefore.fen(),
        playedMove,
        moveNumber: Math.ceil(studyPly / 2),
        opening: studyOpening.name,
        variation: studyOpening.variation || 'Main Line',
        question: question || 'Why is this move played?',
        mode: 'study',
        gameStatus: 'study',
        moveHistory: studyMoves.slice(0, studyPly),
        authorExplanation: studyAuthorExplanation(studyPly),
        authoritativeOpeningNote: studyAuthorExplanation(studyPly),
        repertoireSide: studyRepertoireSide(),
        moveSide: studyMoveSide(studyPly),
        verifiedBoardFacts: coachFacts,
        strictGrounding: true
      }
    });

    if (error) {
      let message = error.message || 'BOZO Coach could not respond.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    if (!data?.explanation) throw new Error('BOZO Coach returned no explanation.');

    const groundedExplanation = sanitizeCoachExplanation(data.explanation, coachFacts);
    lastCoachExplanation = groundedExplanation;
    renderCoachExplanation(groundedExplanation);
  } catch (error) {
    answer.innerHTML = `<div class="coach-error">${escapeHtml(
      error?.message || 'BOZO Coach could not respond.'
    )}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Explain this move';
  }
}

function renderCoachExplanation(explanation) {
  const purposes = Array.isArray(explanation.purpose)
    ? explanation.purpose.filter(Boolean)
    : [];

  $('coach-answer').innerHTML = `
    <p class="coach-summary">${escapeHtml(explanation.summary || '')}</p>

    ${purposes.length ? `
      <div class="coach-section">
        <b>What it accomplishes</b>
        <ul>
          ${purposes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${explanation.watchFor ? `
      <div class="coach-warning">
        <b>Watch for:</b>
        <span>${escapeHtml(explanation.watchFor)}</span>
      </div>
    ` : ''}

    ${explanation.suggestedQuestion ? `
      <button class="coach-follow-up"
              data-coach-question="${escapeHtml(explanation.suggestedQuestion)}">
        ${escapeHtml(explanation.suggestedQuestion)}
      </button>
    ` : ''}
    <div class="coach-grounding-note">BOZO uses the current position, the played move, and the analyzed continuation to explain the decision.</div>
  `;

  const followUp = $('coach-answer').querySelector('[data-coach-question]');
  if (followUp) {
    followUp.addEventListener('click', () => {
      $('coach-question').value = followUp.dataset.coachQuestion;
      askCurrentStudyMove();
    });
  }

  drawCoachAnnotations(
    explanation.arrows || [],
    explanation.highlights || []
  );
}

function squareCenter(square, orientation = 'white') {
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  const displayedFile = orientation === 'white' ? fileIndex : 7 - fileIndex;
  const displayedRank = orientation === 'white' ? 7 - rankIndex : rankIndex;

  return {
    x: displayedFile * 100 + 50,
    y: displayedRank * 100 + 50
  };
}

function validSquare(square) {
  return typeof square === 'string' && /^[a-h][1-8]$/.test(square);
}

// Universal user annotations for every non-live board that did not already
// have its own annotation implementation. Right-drag draws arrows; right-click
// highlights squares. Modifiers follow familiar analysis-board conventions:
// green = default, red = Shift, blue = Ctrl/Cmd, yellow = Alt.
const boardUserAnnotationState = new Map();

function boardAnnotationColor(event) {
  if (event?.shiftKey) return 'red';
  if (event?.ctrlKey || event?.metaKey) return 'blue';
  if (event?.altKey) return 'yellow';
  return 'green';
}

function boardAnnotationSquareFromTarget(target, board) {
  const squareEl = target?.closest?.('[data-square],[data-study-square],[data-endgame-square]');
  if (!squareEl || !board.contains(squareEl)) return '';
  return squareEl.dataset.square || squareEl.dataset.studySquare || squareEl.dataset.endgameSquare || '';
}

function ensureBoardAnnotationState(boardId) {
  if (!boardUserAnnotationState.has(boardId)) {
    boardUserAnnotationState.set(boardId, {
      items: [],
      dragStart: '',
      dragging: false,
      suppressContextMenu: false,
      positionKey: null
    });
  }
  return boardUserAnnotationState.get(boardId);
}

function toggleBoardUserArrow(boardId, from, to, color = 'green') {
  if (!validSquare(from) || !validSquare(to) || from === to) return;
  const state = ensureBoardAnnotationState(boardId);
  const sameRoute = state.items.findIndex(item => item.type === 'arrow' && item.from === from && item.to === to);
  if (sameRoute >= 0) {
    const existing = state.items[sameRoute];
    if (existing.color === color) state.items.splice(sameRoute, 1);
    else existing.color = color;
  } else {
    state.items.push({ type:'arrow', from, to, color });
  }
  state.items = state.items.slice(-64);
  paintBoardUserAnnotations(boardId);
}

function toggleBoardUserSquare(boardId, square, color = 'green') {
  if (!validSquare(square)) return;
  const state = ensureBoardAnnotationState(boardId);
  const existingIndex = state.items.findIndex(item => item.type === 'square' && item.square === square);
  if (existingIndex >= 0) {
    const existing = state.items[existingIndex];
    if (existing.color === color) state.items.splice(existingIndex, 1);
    else existing.color = color;
  } else {
    state.items.push({ type:'square', square, color });
  }
  state.items = state.items.slice(-64);
  paintBoardUserAnnotations(boardId);
}

function clearBoardUserAnnotations(boardId) {
  const state = ensureBoardAnnotationState(boardId);
  state.items = [];
  state.dragStart = '';
  state.dragging = false;
  state.suppressContextMenu = false;
  paintBoardUserAnnotations(boardId);
}

function syncBoardUserAnnotationPosition(boardId, positionKey) {
  const state = ensureBoardAnnotationState(boardId);
  const nextKey = String(positionKey || '');
  if (state.positionKey !== null && state.positionKey !== nextKey) {
    state.items = [];
  }
  state.positionKey = nextKey;
  paintBoardUserAnnotations(boardId);
}

function boardAnnotationOrientation(boardId) {
  if (boardId === 'study-board') return studyOrientation;
  if (boardId === 'game-review-board') return reviewOrientation;
  if (boardId === 'study-builder-board') return studyBuilderOrientation;
  if (boardId === 'train-board') return trainUserSide;
  if (boardId === 'puzzle-board') return puzzleUserSide;
  if (boardId === 'position-analysis-board') return positionOrientation;
  if (boardId === 'endgame-board') return endgameUserColor === 'b' ? 'black' : 'white';
  return 'white';
}

function boardAnnotationLayerId(boardId) {
  return {
    'study-board': 'study-user-arrow-layer',
    'game-review-board': 'review-user-arrow-layer',
    'study-builder-board': 'study-builder-user-arrow-layer',
    'train-board': 'train-user-arrow-layer',
    'puzzle-board': 'puzzle-user-arrow-layer',
    'position-analysis-board': 'position-analysis-user-arrow-layer',
    'endgame-board': 'endgame-user-arrow-layer'
  }[boardId] || '';
}

function annotationSquareGeometry(boardId, square, orientation = 'white') {
  const board = $(boardId);
  const layerId = boardAnnotationLayerId(boardId);
  const svg = layerId ? $(layerId) : null;
  const squareEl = board?.querySelector?.(`[data-square="${square}"],[data-endgame-square="${square}"]`);
  if (board && svg && squareEl) {
    const sr = squareEl.getBoundingClientRect();
    const lr = svg.getBoundingClientRect();
    if (sr.width > 0 && sr.height > 0 && lr.width > 0 && lr.height > 0) {
      const sx = 800 / lr.width;
      const sy = 800 / lr.height;
      return {
        x: (sr.left - lr.left + sr.width / 2) * sx,
        y: (sr.top - lr.top + sr.height / 2) * sy,
        width: sr.width * sx,
        height: sr.height * sy
      };
    }
  }
  const center = squareCenter(square, orientation);
  return { ...center, width:100, height:100 };
}

function paintBoardUserAnnotations(boardId) {
  const layerId = boardAnnotationLayerId(boardId);
  const svg = layerId ? $(layerId) : null;
  if (!svg) return;
  const state = ensureBoardAnnotationState(boardId);
  const orientation = boardAnnotationOrientation(boardId);
  const colors = {
    green:'#78c850',
    red:'#ef5350',
    blue:'#42a5f5',
    yellow:'#f6c945'
  };
  const markup = state.items.map(item => {
    const color = colors[item.color] || colors.green;
    if (item.type === 'square' && validSquare(item.square)) {
      const center = annotationSquareGeometry(boardId, item.square, orientation);
      const width = center.width * .96;
      const height = center.height * .96;
      return `<rect x="${center.x-width/2}" y="${center.y-height/2}" width="${width}" height="${height}" rx="7" fill="${color}" opacity=".27"></rect>`;
    }
    if (item.type === 'arrow' && validSquare(item.from) && validSquare(item.to)) {
      const from = annotationSquareGeometry(boardId, item.from, orientation);
      const to = annotationSquareGeometry(boardId, item.to, orientation);
      const fileDelta = Math.abs(item.to.charCodeAt(0) - item.from.charCodeAt(0));
      const rankDelta = Math.abs(Number(item.to[1]) - Number(item.from[1]));
      const isKnightRoute = (fileDelta === 1 && rankDelta === 2) || (fileDelta === 2 && rankDelta === 1);

      // Separate shaft + explicit triangle. The shaft stops exactly at the
      // triangle base, so it can never run underneath or visually cover the head.
      const arrowGeometry = (segmentStart, tip) => {
        const dx = tip.x - segmentStart.x;
        const dy = tip.y - segmentStart.y;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const headLength = 46;
        const headHalfWidth = 29;
        const base = { x: tip.x - ux * headLength, y: tip.y - uy * headLength };
        const left = { x: base.x + px * headHalfWidth, y: base.y + py * headHalfWidth };
        const right = { x: base.x - px * headHalfWidth, y: base.y - py * headHalfWidth };
        return {
          shaftEnd: base,
          points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
        };
      };

      if (isKnightRoute) {
        const elbow = fileDelta === 2
          ? { x:to.x, y:from.y }
          : { x:from.x, y:to.y };
        const geometry = arrowGeometry(elbow, to);
        return `
          <path d="M ${from.x} ${from.y} L ${elbow.x} ${elbow.y} L ${geometry.shaftEnd.x} ${geometry.shaftEnd.y}"
                fill="none" stroke="${color}" stroke-width="18"
                stroke-linecap="square" stroke-linejoin="miter" opacity=".82"></path>
          <polygon points="${geometry.points}" fill="${color}" opacity=".90"></polygon>`;
      }

      const geometry = arrowGeometry(from, to);
      return `
        <line x1="${from.x}" y1="${from.y}"
              x2="${geometry.shaftEnd.x}" y2="${geometry.shaftEnd.y}"
              stroke="${color}" stroke-width="18"
              stroke-linecap="square" opacity=".82"></line>
        <polygon points="${geometry.points}" fill="${color}" opacity=".90"></polygon>`;
    }
    return '';
  }).join('');
  svg.innerHTML = markup;
}
function registerUniversalBoardAnnotations(boardId) {
  const board = $(boardId);
  if (!board || board.dataset.userAnnotationsReady === '1') return;
  board.dataset.userAnnotationsReady = '1';
  const state = ensureBoardAnnotationState(boardId);

  board.addEventListener('mousedown', event => {
    if (event.button !== 2) return;
    const square = boardAnnotationSquareFromTarget(event.target, board);
    if (!validSquare(square)) return;
    event.preventDefault();
    state.dragStart = square;
    state.dragging = true;
    state.suppressContextMenu = false;
  });

  board.addEventListener('mouseup', event => {
    if (event.button !== 2 || !state.dragging) return;
    const end = boardAnnotationSquareFromTarget(event.target, board);
    const start = state.dragStart;
    const color = boardAnnotationColor(event);
    event.preventDefault();
    state.dragStart = '';
    state.dragging = false;
    if (validSquare(start) && validSquare(end)) {
      state.suppressContextMenu = true;
      if (end === start) toggleBoardUserSquare(boardId, start, color);
      else toggleBoardUserArrow(boardId, start, end, color);
      setTimeout(() => { state.suppressContextMenu = false; }, 50);
    }
  });

  board.addEventListener('contextmenu', event => {
    const square = boardAnnotationSquareFromTarget(event.target, board);
    if (!validSquare(square)) return;
    // Annotation creation is handled deterministically on right-button mouseup.
    // This handler only suppresses the browser menu, avoiding event-order quirks.
    event.preventDefault();
  });

  window.addEventListener('mouseup', event => {
    if (event.button === 2 && state.dragging) {
      state.dragStart = '';
      state.dragging = false;
    }
  });
}

function initializeUniversalBoardAnnotations() {
  ['study-board','game-review-board','study-builder-board','train-board','puzzle-board','position-analysis-board','endgame-board']
    .forEach(registerUniversalBoardAnnotations);

  const clearButtons = {
    'study-clear-marks':'study-board',
    'review-clear-marks':'game-review-board',
    'study-builder-clear-marks':'study-builder-board',
    'train-clear-marks':'train-board',
    'puzzle-clear-marks':'puzzle-board'
  };
  Object.entries(clearButtons).forEach(([buttonId, boardId]) => {
    $(buttonId)?.addEventListener('click', () => clearBoardUserAnnotations(boardId));
  });
}

function drawCoachAnnotations(arrows = [], highlights = []) {
  const svg = $('study-arrow-layer');
  if (!svg) return;

  const colors = {
    green: '#78c850',
    yellow: '#f6c945',
    red: '#ef5350',
    blue: '#42a5f5',
    purple: '#a855f7'
  };

  const markerDefinitions = Object.entries(colors).map(([name, color]) => `
    <marker id="coach-arrow-${name}"
            markerWidth="8"
            markerHeight="8"
            refX="6.5"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="${color}"></path>
    </marker>
  `).join('');

  const highlightMarkup = highlights
    .filter(item => validSquare(item.square))
    .slice(0, 4)
    .map(item => {
      const center = squareCenter(item.square, studyOrientation);
      const color = colors[item.color] || colors.purple;
      return `
        <rect x="${center.x - 48}"
              y="${center.y - 48}"
              width="96"
              height="96"
              rx="10"
              fill="${color}"
              opacity=".25">
          <title>${escapeHtml(item.label || '')}</title>
        </rect>
      `;
    }).join('');

  const arrowMarkup = arrows
    .filter(item => validSquare(item.from) && validSquare(item.to))
    .slice(0, 4)
    .map(item => {
      const from = squareCenter(item.from, studyOrientation);
      const to = squareCenter(item.to, studyOrientation);
      const colorName = colors[item.color] ? item.color : 'purple';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const shorten = 23;
      const endX = to.x - (dx / length) * shorten;
      const endY = to.y - (dy / length) * shorten;

      return `
        <line x1="${from.x}"
              y1="${from.y}"
              x2="${endX}"
              y2="${endY}"
              stroke="${colors[colorName]}"
              stroke-width="14"
              stroke-linecap="round"
              opacity=".86"
              marker-end="url(#coach-arrow-${colorName})">
          <title>${escapeHtml(item.label || '')}</title>
        </line>
      `;
    }).join('');

  svg.innerHTML = `
    <defs>${markerDefinitions}</defs>
    ${highlightMarkup}
    ${arrowMarkup}
  `;
}


const FriendDuelClock = (() => {
  let timer = null;
  let duelId = null;
  let activeColor = 'white';
  let whiteMs = 10 * 60 * 1000;
  let blackMs = 10 * 60 * 1000;
  let lastTick = 0;
  let running = false;

  function format(ms) {
    const safe = Math.max(0, ms);
    const totalSeconds = Math.ceil(safe / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function isHumanFriendDuel(duel) {
    if (!duel) return false;
    const hasTwoHumans = Boolean(
      duel.challenger_id &&
      (duel.opponent_id || duel.challenged_id || duel.accepted_by)
    );
    const botFlag = duel.is_bot === true ||
      duel.opponent_type === 'bot' ||
      duel.mode === 'bot' ||
      duel.game_type === 'bot';
    return hasTwoHumans && !botFlag;
  }

  function paint() {
    const wrap = document.getElementById('friend-duel-clocks');
    if (!wrap) return;
    wrap.querySelectorAll('.player-clock-card').forEach(card => {
      card.classList.toggle('active', card.dataset.color === activeColor && running);
    });
    const white = document.getElementById('friend-clock-white');
    const black = document.getElementById('friend-clock-black');
    if (white) white.textContent = format(whiteMs);
    if (black) black.textContent = format(blackMs);
  }

  function tick() {
    if (!running) return;
    const now = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;
    if (activeColor === 'white') whiteMs -= elapsed;
    else blackMs -= elapsed;
    if (whiteMs <= 0 || blackMs <= 0) {
      running = false;
      stopTimer();
      window.dispatchEvent(new CustomEvent('bozo-clock-expired', {
        detail: { color: whiteMs <= 0 ? 'white' : 'black', duelId }
      }));
    }
    paint();
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start(duel) {
    const wrap = document.getElementById('friend-duel-clocks');
    if (!isHumanFriendDuel(duel)) {
      stop();
      if (wrap) wrap.hidden = true;
      return;
    }

    duelId = duel.id;
    whiteMs = Number(duel.white_time_ms ?? duel.white_clock_ms ?? 600000);
    blackMs = Number(duel.black_time_ms ?? duel.black_clock_ms ?? 600000);
    activeColor = duel.turn_color || duel.active_color || 'white';
    running = !['completed','resigned','drawn','aborted'].includes(duel.status);
    lastTick = Date.now();

    if (wrap) wrap.hidden = false;
    const whiteName = document.getElementById('friend-clock-white-name');
    const blackName = document.getElementById('friend-clock-black-name');
    if (whiteName) whiteName.textContent = duel.white_name || 'White';
    if (blackName) blackName.textContent = duel.black_name || 'Black';

    stopTimer();
    if (running) timer = setInterval(tick, 250);
    paint();
  }

  function onMove(nextColor, serverState = {}) {
    tick();
    activeColor = nextColor;
    if (Number.isFinite(serverState.white_time_ms)) whiteMs = serverState.white_time_ms;
    if (Number.isFinite(serverState.black_time_ms)) blackMs = serverState.black_time_ms;
    lastTick = Date.now();
    paint();
  }

  function stop() {
    running = false;
    stopTimer();
    const wrap = document.getElementById('friend-duel-clocks');
    if (wrap) wrap.hidden = true;
  }

  return { start, onMove, stop, isHumanFriendDuel };
})();


/* ============================================================
   GAME REVIEW: STOCKFISH + BOZO COACH
   ============================================================ */

const REVIEW_STOCKFISH_JS = './assets/stockfish-18-lite-single.js';
const REVIEW_STOCKFISH_WASM = './assets/stockfish-18-lite-single.wasm';
const REVIEW_MATE_SCORE = 100000;

let reviewEngine = null;
let reviewEngineReady = null;
let reviewEngineSearch = null;
let reviewData = null;
let reviewStepIndex = 0;
let reviewOrientation = 'white';
let reviewCoachExplanation = null;
let reviewOpeningCatalog = null;
// Hoisted state: these are referenced by Review setup/reset code before the later bot/voice implementation blocks run.
let webBotMoveEngine = null;
let reviewVoiceEnabled = false;
let reviewVoiceId = 'daniel';

function prepareReviewPage() {
  const label = $('review-engine-state');
  if (label && reviewEngineReady) label.textContent = 'Review engine ready';
}

$$('[data-review-input]').forEach(button => {
  button.addEventListener('click', () => {
    $$('[data-review-input]').forEach(item => item.classList.toggle('active', item === button));
    $('review-paste-panel').hidden = button.dataset.reviewInput !== 'paste';
    $('review-upload-panel').hidden = button.dataset.reviewInput !== 'upload';
  });
});

$('review-pgn-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  $('review-file-name').textContent = file ? file.name : 'No file selected';
  if (!file) return;
  try {
    $('review-pgn-input').value = await file.text();
  } catch (error) {
    $('review-import-message').textContent = 'The selected file could not be read.';
  }
});

$('start-game-review').addEventListener('click', startGameReview);
$('review-recommendation-button')?.addEventListener('click', event => {
  const id = event.currentTarget.dataset.openingId;
  if (id) openStudyById(id);
});
$('review-start').addEventListener('click', () => setReviewStep(0));
$('review-prev').addEventListener('click', () => setReviewStep(reviewStepIndex - 1));
$('review-next').addEventListener('click', () => setReviewStep(reviewStepIndex + 1));
$('review-end').addEventListener('click', () => setReviewStep(reviewData?.rows.length || 0));
$('review-flip').addEventListener('click', () => {
  reviewOrientation = reviewOrientation === 'white' ? 'black' : 'white';
  paintGameReview();
  if (reviewCoachExplanation) drawReviewCoachAnnotations(
    reviewCoachExplanation.arrows || [],
    reviewCoachExplanation.highlights || []
  );
});
$('ask-review-coach').addEventListener('click', askReviewCoach);
$('clear-review-coach').addEventListener('click', clearReviewCoach);
$('review-voice-toggle')?.addEventListener('click',()=>{setReviewVoiceEnabled(!reviewVoiceEnabled);const row=reviewStepIndex===0?null:reviewData?.rows[reviewStepIndex-1];if(reviewVoiceEnabled&&row)speakCurrentReviewExplanation(row,{manual:true});});
$('review-voice-select')?.addEventListener('change',event=>{setReviewVoiceId(event.target.value);const row=reviewStepIndex===0?null:reviewData?.rows[reviewStepIndex-1];if(reviewVoiceEnabled&&row)speakCurrentReviewExplanation(row,{manual:true});});
$('review-coach-question').addEventListener('keydown', event => {
  if (event.key === 'Enter') askReviewCoach();
});

function parseReviewPgn(pgn) {
  const game = new Chess();
  const loaded = game.load_pgn(pgn, { sloppy: true });
  if (!loaded) throw new Error('This PGN could not be parsed. Check that the move text is complete.');
  const history = game.history({ verbose: true });
  if (!history.length) throw new Error('No playable moves were found in this PGN.');

  const headers = typeof game.header === 'function' ? game.header() : {};
  return {
    headers,
    sans: history.map(move => move.san)
  };
}

function reviewCleanSan(move) {
  return String(move || '').replace(/[+#?!]/g, '');
}

async function loadReviewOpeningCatalog() {
  if (reviewOpeningCatalog) return reviewOpeningCatalog;
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn,notes,metadata')
    .eq('status', 'published')
    .limit(10000);
  if (error) throw error;

  reviewOpeningCatalog = (data || []).map(opening => {
    const parser = new Chess();
    const okay = parser.load_pgn(opening.pgn || '', { sloppy: true });

    const builtIn = BOZO_CLOUD_OPENINGS.find(item =>
      item.name === opening.name &&
      (item.variation || '') === (opening.variation || '') &&
      reviewCleanSan(item.pgn || '') === reviewCleanSan(opening.pgn || '')
    );

    const authored =
      opening.metadata?.author_explanations ||
      opening.metadata?.authorExplanations ||
      opening.author_explanations ||
      builtIn?.author_explanations ||
      null;

    return {
      ...opening,
      author_explanations: authored,
      sans: okay ? parser.history().map(reviewCleanSan) : []
    };
  }).filter(opening => opening.sans.length);

  return reviewOpeningCatalog;
}


function reviewOpeningForPly(ply) {
  if (!reviewOpeningCatalog?.length || !reviewData?.rows?.length || !ply) return null;
  const gamePrefix = reviewData.rows.slice(0, ply).map(row => reviewCleanSan(row.san));

  const matches = reviewOpeningCatalog.filter(opening => {
    if (!opening.sans || opening.sans.length < ply) return false;
    for (let i = 0; i < ply; i++) {
      if (opening.sans[i] !== gamePrefix[i]) return false;
    }
    return true;
  });

  if (!matches.length) return null;

  return [...matches].sort((a, b) => {
    const aExact = a.sans.length === ply ? 0 : 1;
    const bExact = b.sans.length === ply ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aVariation = a.variation ? 1 : 0;
    const bVariation = b.variation ? 1 : 0;
    if (aVariation !== bVariation) return aVariation - bVariation;
    const aDistance = Math.abs(a.sans.length - ply);
    const bDistance = Math.abs(b.sans.length - ply);
    if (aDistance !== bDistance) return aDistance - bDistance;
    return String(a.name || '').length - String(b.name || '').length;
  })[0];
}

function reviewOpeningNameForPly(ply) {
  const opening = reviewOpeningForPly(ply);
  if (!opening) return { name: 'Unknown opening', variation: '', opening: null };
  return { name: opening.name || 'Unknown opening', variation: opening.variation || '', opening };
}

async function detectReviewOpening(gameSans) {
  const catalog = await loadReviewOpeningCatalog();
  const cleanGame = gameSans.map(reviewCleanSan);
  let best = null;
  let depth = 0;

  for (const opening of catalog) {
    let matched = 0;
    while (
      matched < opening.sans.length &&
      matched < cleanGame.length &&
      opening.sans[matched] === cleanGame[matched]
    ) matched++;

    if (matched > depth) {
      depth = matched;
      best = opening;
    }
  }

  return { opening: best, depth };
}

class ReviewStockfish {
  constructor() {
    this.worker = null;
    this.listeners = new Set();
    this.readyResolvers = [];
    this.bestResolvers = [];
    this.failure = null;
    this.searching = false;

    // One Stockfish worker cannot safely answer overlapping searches.
    // Review, the evaluation bar, and BOZO Bot all use this queue so
    // every request finishes before the next one begins.
    this.analysisQueue = Promise.resolve();
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    while (this.bestResolvers.length) {
      const pending = this.bestResolvers.shift();
      pending.unsubscribe();
      pending.reject(error);
    }
  }

  send(command) {
    if (!this.worker) throw new Error('Stockfish is not initialized.');
    this.worker.postMessage(command);
  }

  onMessage(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  waitFor(text, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Stockfish timed out waiting for ${text}.`));
      }, timeout);
      const unsubscribe = this.onMessage(message => {
        if (message === text || message.includes(text)) {
          clearTimeout(timer);
          unsubscribe();
          resolve(message);
        }
      });
    });
  }

  async initialize() {
    if (this.worker) return;
    const scriptUrl = new URL(REVIEW_STOCKFISH_JS, document.baseURI);
    this.worker = new Worker(scriptUrl.href);
    this.worker.addEventListener('message', event => this.handle(String(event.data)));
    this.worker.addEventListener('error', event => {
      this.fail(new Error(event?.message || 'Stockfish worker failed to load.'));
    });
    this.worker.addEventListener('messageerror', () => {
      this.fail(new Error('Stockfish returned an unreadable worker message.'));
    });

    // Register each listener BEFORE sending its command. Stockfish can answer
    // immediately, and the old order occasionally missed uciok/readyok.
    const uciReady = this.waitFor('uciok', 30000);
    this.send('uci');
    await uciReady;

        this.send('setoption name Hash value 32');
    this.send('setoption name MultiPV value 1');

    const engineReady = this.waitFor('readyok', 30000);
    this.send('isready');
    await engineReady;
  }

  handle(message) {
    this.listeners.forEach(listener => listener(message));
    if (message.startsWith('bestmove ')) {
      this.searching = false;
      const pending = this.bestResolvers.shift();
      if (pending) {
        pending.unsubscribe();
        pending.resolve(message.split(/\s+/)[1] || null);
      }
    }
  }

  analyze(fen, depth) {
    const run = () => this._analyze(fen, depth);

    // Continue the queue even if the previous search failed.
    const request = this.analysisQueue.then(run, run);
    this.analysisQueue = request.catch(() => undefined);
    return request;
  }

  async _analyze(fen, depth) {
    await this.initialize();
    if (this.failure) throw this.failure;

    this.send(`position fen ${fen}`);
    this.searching = true;

    let cp = null;
    let mate = null;
    let depthSeen = -1;
    let pv = [];

    const unsubscribeInfo = this.onMessage(message => {
      if (!message.startsWith('info ') || /\b(lowerbound|upperbound)\b/.test(message)) return;
      const depthMatch = message.match(/\bdepth (\d+)/);
      const currentDepth = depthMatch ? Number(depthMatch[1]) : depthSeen;
      if (currentDepth < depthSeen) return;
      depthSeen = currentDepth;

      const cpMatch = message.match(/\bscore cp (-?\d+)/);
      const mateMatch = message.match(/\bscore mate (-?\d+)/);
      const pvMatch = message.match(/\bpv (.+)$/);

      if (cpMatch) {
        cp = Number(cpMatch[1]);
        mate = null;
      }
      if (mateMatch) {
        mate = Number(mateMatch[1]);
        cp = null;
      }
      if (pvMatch) pv = pvMatch[1].trim().split(/\s+/);
    });

    const searchTimeout = Math.max(20000, Number(depth || 10) * 2500);

    const bestMove = await new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;

        try {
          this.send('stop');
        } catch (_) {}

        const pendingIndex = this.bestResolvers.findIndex(
          item => item.resolve === wrappedResolve
        );
        if (pendingIndex >= 0) this.bestResolvers.splice(pendingIndex, 1);

        unsubscribeInfo();
        this.searching = false;
        reject(new Error(
          `Stockfish analysis timed out at depth ${depth}.`
        ));
      }, searchTimeout);

      const wrappedResolve = move => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(move);
      };

      const wrappedReject = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      const unsubscribe = () => unsubscribeInfo();
      this.bestResolvers.push({
        resolve: wrappedResolve,
        reject: wrappedReject,
        unsubscribe
      });

      this.send(`go depth ${depth}`);
    });

    unsubscribeInfo();
    return { cp, mate, bestMove, pv, depthSeen };
  }

  analyzeMultiPv(fen, depth = 10, count = 4) {
    const run = () => this._analyzeMultiPv(fen, depth, count);
    const request = this.analysisQueue.then(run, run);
    this.analysisQueue = request.catch(() => undefined);
    return request;
  }

  async _analyzeMultiPv(fen, depth = 10, count = 4) {
    await this.initialize();
    if (this.failure) throw this.failure;

    const multiPv = Math.max(1, Math.min(8, Number(count) || 4));
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(`position fen ${fen}`);
    this.searching = true;

    const lines = new Map();
    const unsubscribeInfo = this.onMessage(message => {
      if (!message.startsWith('info ') || /\b(lowerbound|upperbound)\b/.test(message)) return;
      const depthMatch = message.match(/\bdepth (\d+)/);
      const pvIndexMatch = message.match(/\bmultipv (\d+)/);
      const pvMatch = message.match(/\bpv (.+)$/);
      if (!pvMatch) return;
      const pvIndex = pvIndexMatch ? Number(pvIndexMatch[1]) : 1;
      const currentDepth = depthMatch ? Number(depthMatch[1]) : 0;
      const previous = lines.get(pvIndex);
      if (previous && previous.depth > currentDepth) return;
      const cpMatch = message.match(/\bscore cp (-?\d+)/);
      const mateMatch = message.match(/\bscore mate (-?\d+)/);
      lines.set(pvIndex, {
        rank: pvIndex,
        depth: currentDepth,
        cp: cpMatch ? Number(cpMatch[1]) : null,
        mate: mateMatch ? Number(mateMatch[1]) : null,
        pv: pvMatch[1].trim().split(/\s+/)
      });
    });

    const searchTimeout = Math.max(20000, Number(depth || 10) * 2500);
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { this.send('stop'); } catch (_) {}
          const pendingIndex = this.bestResolvers.findIndex(item => item.resolve === wrappedResolve);
          if (pendingIndex >= 0) this.bestResolvers.splice(pendingIndex, 1);
          this.searching = false;
          reject(new Error(`Stockfish MultiPV analysis timed out at depth ${depth}.`));
        }, searchTimeout);
        const wrappedResolve = move => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(move);
        };
        const wrappedReject = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error);
        };
        this.bestResolvers.push({ resolve: wrappedResolve, reject: wrappedReject, unsubscribe: () => {} });
        this.send(`go depth ${depth}`);
      });
    } finally {
      unsubscribeInfo();
      this.searching = false;
      this.send('setoption name MultiPV value 1');
    }

    return [...lines.values()].sort((a,b) => a.rank - b.rank);
  }

  async newGame() {
    await this.initialize();

    const ready = this.waitFor('readyok', 30000);
    this.send('ucinewgame');
    this.send('isready');
    await ready;
  }

  terminate() {
    try {
      if (this.searching && this.worker) this.worker.postMessage('stop');
    } catch (_) {}

    try {
      this.worker?.terminate();
    } catch (_) {}

    this.worker = null;
    this.failure = null;
    this.searching = false;
    this.listeners.clear();
    this.bestResolvers = [];
    this.analysisQueue = Promise.resolve();
  }
}

async function getReviewEngine() {
  if (reviewEngineReady) return reviewEngineReady;
  reviewEngineReady = (async () => {
    $('review-engine-state').textContent = 'Loading review engine…';
    reviewEngine = new ReviewStockfish();
    await reviewEngine.initialize();
    $('review-engine-state').textContent = 'Review engine ready';
    return reviewEngine;
  })().catch(error => {
    try {
      reviewEngine?.terminate();
    } catch (_) {}
    reviewEngineReady = null;
    reviewEngine = null;
    $('review-engine-state').textContent = 'Engine failed';
    throw error;
  });
  return reviewEngineReady;
}

function resetManagedStockfish() {
  try {
    reviewEngine?.terminate();
  } catch (_) {}

  try {
    if (webBotMoveEngine && webBotMoveEngine !== reviewEngine) {
      webBotMoveEngine.terminate();
    }
  } catch (_) {}

  reviewEngine = null;
  reviewEngineReady = null;
  webBotMoveEngine = null;

  const label = $('review-engine-state');
  if (label) label.textContent = 'Engine will restart';
}

async function getWebBotMoveEngine() {
  // One managed Stockfish worker is shared by BOZO Bot and Review.
  // The evaluation bar stays paused during bot play.
  return getReviewEngine();
}

function whiteReviewMate(result, turn) {
  if (result?.mate == null) return null;
  // UCI scores are from the side-to-move perspective. Normalize mate signs
  // exactly like centipawn scores so every Review consumer uses White's
  // perspective: positive = White mates, negative = Black mates.
  return turn === 'w' ? Number(result.mate) : -Number(result.mate);
}

function whiteReviewEval(result, turn) {
  const whiteMate = whiteReviewMate(result, turn);
  if (whiteMate != null) {
    return whiteMate > 0
      ? REVIEW_MATE_SCORE - Math.abs(whiteMate)
      : -REVIEW_MATE_SCORE + Math.abs(whiteMate);
  }
  const cp = Number(result?.cp) || 0;
  return turn === 'w' ? cp : -cp;
}

function reviewWinPercent(whiteCp) {
  const cp = Math.max(-1000, Math.min(1000, whiteCp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function reviewMoveAccuracy(winLoss) {
  const accuracy = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

function classifyReviewLoss(loss, isBook, context = {}) {
  if (isBook) return { label: 'Book', cls: 'book' };
  if (context.brilliant) return { label: 'Brilliant', cls: 'brilliant' };
  if (context.great) return { label: 'Great', cls: 'great' };
  if (loss <= 0) return { label: 'Best', cls: 'best' };
  if (loss <= 20) return { label: 'Excellent', cls: 'excellent' };
  if (loss <= 50) return { label: 'Good', cls: 'good' };
  if (loss <= 100) return { label: 'Inaccuracy', cls: 'inaccuracy' };
  if (loss <= 200) return { label: 'Mistake', cls: 'mistake' };
  return { label: 'Blunder', cls: 'blunder' };
}

// Great is about necessity, not merely low centipawn loss. BOZO compares the
// played top move with the best alternative from the same position.
function reviewScoreForMover(line, mover) {
  if (!line) return null;
  if (line.mate != null) {
    const signed = line.mate > 0 ? REVIEW_MATE_SCORE - Math.abs(line.mate) : -REVIEW_MATE_SCORE + Math.abs(line.mate);
    return signed; // MultiPV scores are already from the side-to-move perspective.
  }
  return Number.isFinite(Number(line.cp)) ? Number(line.cp) : null;
}

function reviewMoveUci(move) {
  return move ? `${move.from}${move.to}${move.promotion || ''}`.toLowerCase() : '';
}

function reviewGreatMoveContext(multiLines = [], playedUci = '') {
  const lines = (multiLines || []).filter(line => line?.pv?.[0]).sort((a,b)=>(a.rank||99)-(b.rank||99));
  if (lines.length < 2 || !playedUci) return { great:false, uniqueGap:0, alternative:null, reason:'' };

  const top = lines[0], second = lines[1];
  if (String(top.pv[0]).toLowerCase() !== playedUci.toLowerCase()) {
    return { great:false, uniqueGap:0, alternative:second, reason:'' };
  }

  const topScore = reviewScoreForMover(top), secondScore = reviewScoreForMover(second);
  if (topScore == null || secondScore == null) return { great:false, uniqueGap:0, alternative:second, reason:'' };

  const gap = Math.max(0, topScore - secondScore);

  // Great means necessity, not merely a big engine gap.
  // If MultiPV #2 already gives away the advantage/game, every lower-ranked
  // legal move does too.
  const keepsWinningAdvantage = topScore >= 150 && secondScore < 75;
  const onlyMoveToHoldGame = topScore > -75 && secondScore <= -150;

  let reason = '';
  if (keepsWinningAdvantage) reason = 'only move that preserves a clear winning advantage';
  else if (onlyMoveToHoldGame) reason = 'only move that avoids a clearly losing position';

  return {
    great: Boolean(reason),
    uniqueGap: gap,
    alternative: second,
    reason,
    topScore,
    secondScore
  };
}

function reviewSideMaterial(fen, side) {
  const g = new Chess(fen), values={p:1,n:3,b:3,r:5,q:9,k:0}; let total=0;
  for (const rank of g.board()) for (const piece of rank) if (piece?.color===side) total += values[piece.type] || 0;
  return total;
}

function reviewBrilliantSacrificeEvidence(beforeFen, afterFen, mover, pv = []) {
  // Compare against material BEFORE the played move so an ordinary capture
  // followed by a recapture cannot masquerade as a sacrifice.
  try {
    const materialBefore = reviewSideMaterial(beforeFen, mover);
    const materialAfterMove = reviewSideMaterial(afterFen, mover);
    const g = new Chess(afterFen);

    if (materialAfterMove <= materialBefore - 1) return true;

    // For an offered sacrifice, Stockfish's best reply must actually accept it.
    const reply = (pv || [])[0];
    if (!reply) return false;
    const accepted = g.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]||'q'});
    if (!accepted) return false;

    return reviewSideMaterial(g.fen(), mover) <= materialBefore - 1;
  } catch (_) {}
  return false;
}

function reviewClassificationIcon(cls='') {
  const safe = ['book','brilliant','great','best','excellent','good','inaccuracy','mistake','blunder'].includes(cls) ? cls : 'good';
  return `<img class="review-move-type-icon" src="./assets/review-icons/${safe}.svg" alt="" aria-hidden="true">`;
}

function reviewUciToSan(fen, uci) {
  if (!uci || uci === '(none)') return ' - ';
  const game = new Chess(fen);
  const move = game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] || 'q'
  });
  return move?.san || uci;
}

function reviewPvToSan(fen, uciMoves = [], maximumMoves = 6) {
  const game = new Chess(fen);
  const sans = [];

  for (const uci of (uciMoves || []).slice(0, maximumMoves)) {
    if (!uci || uci.length < 4) break;

    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || 'q'
    });

    if (!move) break;
    sans.push(move.san);
  }

  return sans;
}

function reviewBestMovePosition(fen, bestMoveSan) {
  if (!fen || !bestMoveSan || bestMoveSan === ' - ') return '';
  const game = new Chess(fen);
  const move = game.move(bestMoveSan, { sloppy: true });
  return move ? game.fen() : '';
}

function reviewMaterialProfile(fen = '') {
  const board = String(fen || '').split(' ')[0];
  const counts = { Q:0, q:0, R:0, r:0, B:0, b:0, N:0, n:0, P:0, p:0 };
  for (const piece of board) if (piece in counts) counts[piece]++;
  const value = piece => ({ Q:9, R:5, B:3, N:3 }[piece] || 0);
  const whiteNonPawn = counts.Q * value('Q') + counts.R * value('R') + counts.B * value('B') + counts.N * value('N');
  const blackNonPawn = counts.q * value('Q') + counts.r * value('R') + counts.b * value('B') + counts.n * value('N');
  return {
    counts,
    queens: counts.Q + counts.q,
    rooks: counts.R + counts.r,
    minors: counts.B + counts.b + counts.N + counts.n,
    pawns: counts.P + counts.p,
    whiteNonPawn,
    blackNonPawn,
    totalNonPawn: whiteNonPawn + blackNonPawn
  };
}

function reviewLooksLikeEndgame(fen = '') {
  const material = reviewMaterialProfile(fen);
  // Conservative on purpose: BOZO should not call a queen-heavy position an
  // endgame just because the game is late. Queenless reduced-material positions
  // and genuinely sparse queen endings qualify.
  if (material.queens === 0 && material.totalNonPawn <= 26) return true;
  if (material.queens === 0 && material.rooks <= 2 && material.minors <= 4) return true;
  if (material.totalNonPawn <= 16) return true;
  if (material.queens <= 1 && material.totalNonPawn <= 20 && material.pawns <= 10) return true;
  return false;
}

function reviewPhasePlan(rows = [], bookDepth = 0) {
  if (!rows.length) return { openingEnd: 0, endgameStart: null };

  // The opening database is the strongest evidence we have. Give a short
  // transition cushion after book rather than using a hard-coded move number.
  let openingEnd = Math.max(0, Math.min(rows.length, Number(bookDepth) || 0));
  const minimumOpening = Math.min(rows.length, 10);
  openingEnd = Math.max(openingEnd, minimumOpening);

  // If still very early after book, wait until development has progressed or
  // enough plies have elapsed. This avoids calling move 6 a middlegame simply
  // because the exact line was not in BOZO's database.
  const developmentSquares = new Set(['b1','g1','b8','g8','c1','f1','c8','f8']);
  for (let i = openingEnd; i < Math.min(rows.length, 24); i++) {
    const game = new Chess(rows[i].fen);
    let undeveloped = 0;
    for (const square of developmentSquares) {
      const piece = game.get(square);
      if (piece && (piece.type === 'n' || piece.type === 'b')) undeveloped++;
    }
    if (i + 1 >= 16 || undeveloped <= 3) {
      openingEnd = i + 1;
      break;
    }
  }

  let endgameStart = null;
  for (let i = Math.max(openingEnd + 4, 16); i < rows.length; i++) {
    if (!reviewLooksLikeEndgame(rows[i].fen)) continue;
    // Require the reduced-material state to persist for a few plies so a
    // temporary tactical sequence is not mislabeled as a phase transition.
    const persistent = rows.slice(i, Math.min(rows.length, i + 4))
      .every(row => reviewLooksLikeEndgame(row.fen));
    if (persistent) {
      endgameStart = i + 1;
      break;
    }
  }

  return { openingEnd, endgameStart };
}

function reviewGamePhase(ply, totalPlies, fen = '', phasePlan = null) {
  if (phasePlan) {
    if (ply <= phasePlan.openingEnd) return 'opening';
    if (phasePlan.endgameStart && ply >= phasePlan.endgameStart) return 'endgame';
    return 'middlegame';
  }
  if (ply <= 16) return 'opening';
  if (reviewLooksLikeEndgame(fen)) return 'endgame';
  return 'middlegame';
}

function reviewPhaseLabel(phase = '') {
  return ({ opening:'Opening', middlegame:'Middlegame', endgame:'Endgame' })[phase] || 'Game';
}

function reviewMoveNotation(row) {
  if (!row) return ' - ';
  return `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san}`;
}

function reviewPlayerSideCode() {
  return reviewData?.playerSide === 'black' ? 'b' : 'w';
}

function reviewSideDisplayLabel(sideCode) {
  const isYou = sideCode === reviewPlayerSideCode();
  const color = sideCode === 'w' ? 'White' : 'Black';
  return `${color} · ${isYou ? 'You' : 'Opponent'}`;
}

function reviewPlayerPerspectiveDescription(cp = 0, mate = null) {
  const objective = reviewPositionDescription(cp, mate);
  const side = reviewData?.playerSide;
  if (!side) return objective;
  if (mate != null) {
    const youWinning = (side === 'white' && mate > 0) || (side === 'black' && mate < 0);
    return youWinning ? `You have a forced mate in ${Math.abs(mate)}` : `Your opponent has a forced mate in ${Math.abs(mate)}`;
  }
  if (Math.abs(cp) < 25) return 'The position is equal';
  const youAhead = (side === 'white' && cp > 0) || (side === 'black' && cp < 0);
  const magnitude = Math.abs(cp);
  const degree = magnitude < 75 ? 'slightly better' : magnitude < 160 ? 'clearly better' : magnitude < 300 ? 'much better' : 'winning';
  return youAhead ? `You are ${degree}` : `Your opponent is ${degree}`;
}

function reviewPhaseRows(phase) {
  return (reviewData?.rows || []).filter(row => row.phase === phase);
}

function reviewPhaseSummary(phase, rows) {
  if (!rows.length) return 'This game did not contain a clearly detected phase here.';
  const yourSide = reviewPlayerSideCode();
  const oppSide = yourSide === 'w' ? 'b' : 'w';
  const yourRows = rows.filter(row => row.mover === yourSide);
  const oppRows = rows.filter(row => row.mover === oppSide);
  const yourAccuracy = reviewPhaseAccuracyFor(yourRows);
  const oppAccuracy = reviewPhaseAccuracyFor(oppRows);
  const yourWorst = [...yourRows].sort((a,b) => b.rawEngineLoss - a.rawEngineLoss)[0];
  const oppWorst = [...oppRows].sort((a,b) => b.rawEngineLoss - a.rawEngineLoss)[0];
  const start = rows[0], end = rows[rows.length - 1];
  let lead = `${reviewPhaseLabel(phase)}: ${reviewMoveNotation(start).split(' ')[0]} through ${reviewMoveNotation(end).split(' ')[0]}.`;
  if (yourAccuracy != null && oppAccuracy != null) lead += ` You scored ${yourAccuracy}% versus your opponent's ${oppAccuracy}%.`;
  if (yourWorst?.rawEngineLoss >= 100) return `${lead} Your main issue was ${reviewMoveNotation(yourWorst)}, a ${yourWorst.label.toLowerCase()} with a sizeable evaluation cost.`;
  if (oppWorst?.rawEngineLoss >= 100) return `${lead} Your opponent's biggest error was ${reviewMoveNotation(oppWorst)}, which gave you the clearest opportunity in this phase.`;
  if (yourWorst?.rawEngineLoss > 0) return `${lead} Your largest slip was ${reviewMoveNotation(yourWorst)}, but the phase stayed relatively stable.`;
  return `${lead} You handled this phase cleanly with no major errors.`;
}

function reviewBuildEvents(rows, openingMatch, phasePlan) {
  const events = [];
  if (openingMatch?.opening && openingMatch.depth) {
    events.push({
      ply:1,
      type:'opening',
      title:'Opening identified',
      detail:`${openingMatch.opening.name}${openingMatch.opening.variation ? `: ${openingMatch.opening.variation}` : ''} · ${openingMatch.depth} matched book plies`
    });
  }

  if (phasePlan.openingEnd && phasePlan.openingEnd < rows.length) {
    const row = rows[phasePlan.openingEnd - 1];
    events.push({
      ply:phasePlan.openingEnd,
      type:'phase',
      title:'Opening complete',
      detail:`Around ${reviewMoveNotation(row)}, the game moves beyond opening preparation and into independent play.`
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const before = reviewMaterialProfile(rows[i].previousFen);
    const after = reviewMaterialProfile(rows[i].fen);
    if (before.queens === 2 && after.queens < 2) {
      events.push({
        ply:rows[i].ply,
        type:'trade',
        title:'Major simplification',
        detail:`${reviewMoveNotation(rows[i])} begins a queen trade and changes the character of the position.`
      });
      break;
    }
  }

  if (phasePlan.endgameStart) {
    const row = rows[phasePlan.endgameStart - 1];
    events.push({
      ply:phasePlan.endgameStart,
      type:'phase',
      title:'Endgame transition',
      detail:`By ${reviewMoveNotation(row)}, reduced material has persisted long enough for BOZO to treat the position as an endgame.`
    });
  }

  const critical = rows.filter(row => !row.terminal && row.rawEngineLoss >= 100)
    .sort((a,b) => b.rawEngineLoss - a.rawEngineLoss)
    .slice(0, 3);

  critical.forEach((row, index) => {
    const isTurningPoint = index === 0 && row.rawEngineLoss >= 180;
    const better = row.engineBest && row.engineBest !== ' - '
      ? ` Better was ${row.engineBest}.`
      : '';
    events.push({
      ply:row.ply,
      type:isTurningPoint ? 'turning' : 'critical',
      title:isTurningPoint ? 'Turning point' : row.label,
      detail:`${reviewMoveNotation(row)} was the ${index === 0 ? 'largest' : 'another important'} evaluation swing in the game.${better}`
    });
  });

  const checkmateRow = rows.find(row => row.terminal?.type === 'checkmate');
  if (checkmateRow) {
    events.push({ ply:checkmateRow.ply, type:'mate', title:'Checkmate', detail:`${reviewMoveNotation(checkmateRow)} ends the game by checkmate.` });
  }

  const mateRow = rows.find(row => row.mate != null && !row.terminal);
  if (mateRow) {
    events.push({
      ply:mateRow.ply,
      type:'mate',
      title:'Forced mate appears',
      detail:`After ${reviewMoveNotation(mateRow)}, the position contains a forced mating sequence.`
    });
  }

  return events.sort((a,b) => a.ply - b.ply).slice(0, 8);
}

function reviewGameStory(rows, phasePlan, playerSide = reviewData?.playerSide) {
  if (!rows.length) return 'BOZO could not build a game story from this PGN.';
  const turning = [...rows].sort((a,b) => b.rawEngineLoss - a.rawEngineLoss)[0];
  const early = rows[Math.min(rows.length - 1, Math.max(0, phasePlan.openingEnd - 1))];
  const end = rows[rows.length - 1];
  const phases = phasePlan.endgameStart ? 'a middlegame and later an endgame' : 'a middlegame';
  const oldSide = reviewData?.playerSide;
  if (reviewData) reviewData.playerSide = playerSide || oldSide;
  const earlyDesc = reviewPlayerPerspectiveDescription(early?.whiteCp || 0, early?.mate);
  const endDesc = end?.terminal?.type === 'checkmate'
    ? `${end.terminal.winner === (playerSide === 'black' ? 'b' : 'w') ? 'You won' : 'Your opponent won'} by checkmate`
    : reviewPlayerPerspectiveDescription(end?.whiteCp || 0, end?.mate);
  if (reviewData) reviewData.playerSide = oldSide || playerSide;

  if (turning && turning.rawEngineLoss >= 100) {
    const turningWasYours = turning.mover === (playerSide === 'black' ? 'b' : 'w');
    const owner = turningWasYours ? 'Your biggest turning point' : `Your opponent's biggest turning point`;
    return `The opening transitioned into ${phases}. ${earlyDesc}. ${owner} came at ${reviewMoveNotation(turning)}. By the final analyzed position, ${endDesc.toLowerCase()}.`;
  }
  return `The game moved from the opening into ${phases} without a single major evaluation swing. By the final analyzed position, ${endDesc.toLowerCase()}.`;
}

function reviewMoveWindow(rows, selectedIndex, beforeCount = 6, afterCount = 6) {
  const start = Math.max(0, selectedIndex - beforeCount);
  const end = Math.min(rows.length, selectedIndex + afterCount + 1);

  return rows.slice(start, end).map((row, localIndex) => ({
    ply: row.ply,
    moveNumber: Math.ceil(row.ply / 2),
    side: row.ply % 2 === 1 ? 'White' : 'Black',
    san: row.san,
    classification: row.label,
    isSelected: start + localIndex === selectedIndex
  }));
}

function reviewHistoryToMoveText(history = []) {
  const output = [];
  for (let index = 0; index < history.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const white = history[index] || '';
    const black = history[index + 1] || '';
    output.push(`${moveNumber}. ${white}${black ? ` ${black}` : ''}`);
  }
  return output.join(' ');
}

function reviewPlanContinuityPrompt(row, priorMoves, laterMoves) {
  return [
    `Recent moves before the selected move: ${priorMoves.join(' ') || 'not supplied'}.`,
    `The game continued after it with: ${laterMoves.join(' ') || 'not supplied'}.`,
    `Explain whether ${row.san} continued the player's previous plan, changed plans, or abandoned it.`,
    `Explain whether that change was justified by the position.`
  ].join(' ');
}


function reviewChessBoolean(game, names) {
  for (const name of names) {
    try {
      if (typeof game?.[name] === 'function') return Boolean(game[name]());
    } catch (_) {}
  }
  return false;
}

function reviewIsCheckmate(game) {
  return reviewChessBoolean(game, ['isCheckmate', 'inCheckmate', 'in_checkmate']);
}

function reviewIsStalemate(game) {
  return reviewChessBoolean(game, ['isStalemate', 'inStalemate', 'in_stalemate']);
}

function reviewIsThreefold(game) {
  return reviewChessBoolean(game, ['isThreefoldRepetition', 'inThreefoldRepetition', 'in_threefold_repetition']);
}

function reviewIsInsufficient(game) {
  return reviewChessBoolean(game, ['isInsufficientMaterial', 'insufficientMaterial', 'insufficient_material']);
}

function reviewIsDraw(game) {
  if (reviewChessBoolean(game, ['isDraw', 'inDraw', 'in_draw'])) return true;
  return reviewIsStalemate(game) || reviewIsThreefold(game) || reviewIsInsufficient(game);
}

function reviewIsGameOver(game) {
  // chess.js 0.10.x
  if (typeof game?.game_over === 'function') {
    try { return Boolean(game.game_over()); } catch (_) {}
  }

  // chess.js 1.x
  if (typeof game?.isGameOver === 'function') {
    try { return Boolean(game.isGameOver()); } catch (_) {}
  }

  return reviewIsCheckmate(game) || reviewIsDraw(game);
}

async function computeWebsiteReview(sans, depth, bookDepth, onProgress) {
  const engine = await getReviewEngine();
  const game = new Chess();
  const plies = [...sans];
  const initialFen = game.fen();

  let analysis = await engine.analyze(initialFen, depth);
  let evalBefore = whiteReviewEval(analysis, game.turn());
  let engineBestBefore = reviewUciToSan(initialFen, analysis.bestMove);
  let pvBefore = analysis.pv || [];
  const rows = [];

  for (let index = 0; index < plies.length; index++) {
    const previousFen = game.fen();
    const mover = game.turn();
    const played = game.move(plies[index], { sloppy: true });
    if (!played) break;

    const fen = game.fen();
    const isCheckmate = reviewIsCheckmate(game);
    const isTerminal = reviewIsGameOver(game);
    let evalAfter, terminal = null;

    if (isCheckmate) {
      // A delivered mate is terminal, not an engine evaluation. Never interpret
      // Stockfish's terminal `mate 0` as a forced mate for the losing side.
      evalAfter = mover === 'w' ? REVIEW_MATE_SCORE : -REVIEW_MATE_SCORE;
      terminal = { type: 'checkmate', winner: mover };
      analysis = { cp: null, mate: null, bestMove: '(none)', pv: [] };
    } else {
      analysis = await engine.analyze(fen, depth);
      evalAfter = whiteReviewEval(analysis, game.turn());
      if (isTerminal) {
        terminal = {
          type: reviewIsStalemate(game) ? 'stalemate'
            : reviewIsThreefold(game) ? 'threefold_repetition'
            : reviewIsInsufficient(game) ? 'insufficient_material'
            : 'draw',
          winner: null
        };
      }
    }

    // Compare real alternatives in the pre-move position. This powers BOZO's
    // necessity-based Great classification instead of treating Great as a CPL bucket.
    let choiceLines = [];
    if (!isCheckmate && index >= bookDepth) {
      try { choiceLines = await engine.analyzeMultiPv(previousFen, depth, 3); } catch (_) {}
    }

    const rawLoss = isCheckmate ? 0 : (mover === 'w'
      ? evalBefore - evalAfter
      : evalAfter - evalBefore);
    const engineLoss = Math.max(0, Math.round(rawLoss));
    const isBook = index < bookDepth;
    const playedUci = reviewMoveUci(played);
    const necessity = reviewGreatMoveContext(choiceLines, playedUci);
    const topMove = choiceLines?.[0]?.pv?.[0] ? String(choiceLines[0].pv[0]).toLowerCase() === playedUci : false;
    const sacrifice = topMove && reviewBrilliantSacrificeEvidence(previousFen, fen, mover, analysis?.pv || []);
    // Brilliant is deliberately stricter than Great: it must be a top move,
    // concretely sound, and involve a real material concession in Stockfish's line.
    const brilliant = !isBook && topMove && engineLoss <= 20 && sacrifice && necessity.great;
    const classification = isCheckmate
      ? { label: 'Best', cls: 'best' }
      : classifyReviewLoss(engineLoss, isBook, { great: !brilliant && necessity.great, brilliant });

    const winBefore = reviewWinPercent(evalBefore);
    const winAfter = reviewWinPercent(evalAfter);
    const moverBefore = mover === 'w' ? winBefore : 100 - winBefore;
    const moverAfter = mover === 'w' ? winAfter : 100 - winAfter;
    const accuracy = isCheckmate || isBook ? 100 : reviewMoveAccuracy(moverBefore - moverAfter);

    rows.push({
      ply: index + 1,
      mover,
      san: played.san,
      from: played.from,
      to: played.to,
      previousFen,
      fen,
      whiteCp: evalAfter,
      mate: isCheckmate ? null : whiteReviewMate(analysis, game.turn()),
      terminal,
      engineLoss: isBook || isCheckmate ? 0 : engineLoss,
      rawEngineLoss: engineLoss,
      accuracy,
      label: classification.label,
      cls: classification.cls,
      isBook,
      engineBest: isCheckmate ? played.san : engineBestBefore,
      bestMoveFen: reviewBestMovePosition(previousFen, isCheckmate ? played.san : engineBestBefore),
      principalVariation: isCheckmate ? [] : pvBefore.slice(0, 10),
      principalVariationSan: isCheckmate ? [] : reviewPvToSan(previousFen, pvBefore, 8),
      replyVariation: isCheckmate ? [] : (analysis.pv || []).slice(0, 10),
      replyVariationSan: isCheckmate ? [] : reviewPvToSan(fen, analysis.pv || [], 8),
      wasTop: isCheckmate || reviewCleanSan(engineBestBefore) === reviewCleanSan(played.san),
      choiceLines,
      uniqueMoveGap: necessity.uniqueGap || 0,
      greatReason: necessity.reason || '',
      brilliantSacrifice: Boolean(brilliant)
    });

    evalBefore = evalAfter;
    engineBestBefore = isTerminal ? ' - ' : reviewUciToSan(fen, analysis.bestMove);
    pvBefore = isTerminal ? [] : (analysis.pv || []);
    onProgress?.(index + 1, plies.length);
  }

  const phasePlan = reviewPhasePlan(rows, bookDepth);
  rows.forEach(row => {
    row.phase = reviewGamePhase(row.ply, rows.length, row.fen, phasePlan);
  });

  const initialAnalysis = await engine.analyze(initialFen, depth);
  return {
    initialFen,
    initialEval: whiteReviewEval(initialAnalysis, 'w'),
    initialMate: whiteReviewMate(initialAnalysis, 'w'),
    rows,
    phasePlan
  };
}

function reviewAverage(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function reviewAccuracyFor(rows) {
  const value = reviewAverage(rows.map(row => row.accuracy));
  return value == null ? null : Math.round(value * 10) / 10;
}

function reviewRowsForSide(rows = [], side = 'w') {
  return rows.filter(row => row.mover === side);
}

function reviewErrorCounts(rows = []) {
  return rows.reduce((counts, row) => {
    if (row?.cls === 'inaccuracy') counts.inaccuracy++;
    if (row?.cls === 'mistake') counts.mistake++;
    if (row?.cls === 'blunder') counts.blunder++;
    return counts;
  }, { inaccuracy:0, mistake:0, blunder:0 });
}

// A phase score should communicate how well the phase was actually played, not
// let a run of book/best moves visually erase a costly error. Start from the
// engine-derived move accuracy, then apply a transparent severity penalty.
function reviewPhaseAccuracyFor(rows = []) {
  if (!rows.length) return null;
  const base = reviewAccuracyFor(rows);
  if (base == null) return null;
  const errors = reviewErrorCounts(rows);
  const penalty = errors.inaccuracy * 1.5 + errors.mistake * 4 + errors.blunder * 9;
  return Math.max(0, Math.round((base - penalty) * 10) / 10);
}

function reviewErrorSummary(rows = []) {
  const errors = reviewErrorCounts(rows);
  const parts = [];
  if (errors.inaccuracy) parts.push(`${errors.inaccuracy} inaccuracy${errors.inaccuracy === 1 ? '' : 'ies'}`.replace('inaccuracys','inaccuracies'));
  if (errors.mistake) parts.push(`${errors.mistake} mistake${errors.mistake === 1 ? '' : 's'}`);
  if (errors.blunder) parts.push(`${errors.blunder} blunder${errors.blunder === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'No inaccuracies, mistakes, or blunders';
}

async function startGameReview() {
  const message = $('review-import-message');
  const button = $('start-game-review');
  const pgn = $('review-pgn-input').value.trim();

  message.textContent = '';
  const playerSide = $('review-player-side').value;
  if (!pgn) {
    message.textContent = 'Paste or upload a PGN first.';
    return;
  }
  if (!['white','black'].includes(playerSide)) {
    message.textContent = 'Choose whether you played White or Black before analyzing the game.';
    $('review-player-side').focus();
    return;
  }

  let parsed;
  try {
    parsed = parseReviewPgn(pgn);
  } catch (error) {
    message.textContent = error.message;
    return;
  }

  button.disabled = true;
  button.textContent = 'Analyzing…';
  $('review-progress-wrap').hidden = false;
  $('review-results').hidden = true;

  try {
    let engine;

    try {
      engine = await getReviewEngine();
      await engine.newGame();
    } catch (firstEngineError) {
      console.warn('Restarting review engine before review:', firstEngineError);
      resetManagedStockfish();
      engine = await getReviewEngine();
      await engine.newGame();
    }

    const openingMatch = await detectReviewOpening(parsed.sans);
    const depth = Number($('review-depth').value);

    reviewData = await computeWebsiteReview(
      parsed.sans,
      depth,
      openingMatch.depth,
      (done, total) => {
        const percentage = Math.round(done / total * 100);
        $('review-progress-label').textContent =
          `Analyzing full game · move ${done} of ${total}`;
        $('review-progress-percent').textContent = `${percentage}%`;
        $('review-progress-bar').style.width = `${percentage}%`;
      }
    );

    reviewData.headers = parsed.headers;
    reviewData.openingMatch = openingMatch;

    const reviewOpeningExplanations =
      openingMatch?.opening?.author_explanations ||
      openingMatch?.opening?.metadata?.author_explanations ||
      openingMatch?.opening?.metadata?.authorExplanations ||
      {};
    const reviewOpeningTakeaways =
      openingMatch?.opening?.author_takeaways ||
      openingMatch?.opening?.metadata?.author_takeaways ||
      openingMatch?.opening?.metadata?.authorTakeaways ||
      {};

    reviewData.rows.forEach(row => {
      row.authorExplanation = String(
        reviewOpeningExplanations?.[String(row.ply)] ||
        reviewOpeningExplanations?.[row.ply] ||
        ''
      ).trim();
      row.authorTakeaway = String(
        reviewOpeningTakeaways?.[String(row.ply)] ||
        reviewOpeningTakeaways?.[row.ply] ||
        ''
      ).trim();
    });

    reviewData.playerSide = playerSide;
    reviewData.events = reviewBuildEvents(reviewData.rows, openingMatch, reviewData.phasePlan);

    primeReviewTeachingNotes();
    reviewData.story = reviewGameStory(reviewData.rows, reviewData.phasePlan, playerSide);
    reviewStepIndex = 0;
    reviewOrientation = playerSide;

    renderReviewSummary();
    renderReviewMoveList();
    clearReviewCoach();
    paintGameReview();
    $('review-results').hidden = false;
    const matchedOpening = openingMatch?.opening || openingMatch?.data || openingMatch;
    const recommendation = $('review-opening-recommendation');
    if (recommendation && matchedOpening?.id) {
      recommendation.hidden = false;
      $('review-recommendation-title').textContent = matchedOpening.name || 'Study the detected opening';
      $('review-recommendation-copy').textContent = `BOZO recognized ${matchedOpening.name || 'this opening'} in your game. The review now separates the opening, middlegame, and any detected endgame so you can see what happened after book.`;
      $('review-recommendation-button').dataset.openingId = matchedOpening.id;
    } else if (recommendation) recommendation.hidden = true;
    await logActivity('game_reviewed', { opening_id: matchedOpening?.id || null, opening: matchedOpening?.name || 'Unknown opening', accuracy: reviewAccuracyFor(reviewData.rows) });
    $('review-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);

    if (/Stockfish|worker|uciok|readyok|timed out/i.test(error?.message || '')) {
      resetManagedStockfish();
      $('review-engine-state').textContent = 'Engine reset · try again';
    }

    message.textContent = error?.message || 'Game review failed.';
  } finally {
    button.disabled = false;
    button.textContent = 'Analyze game';
    $('review-progress-wrap').hidden = true;
  }
}

function renderReviewSummary() {
  const rows = reviewData.rows;
  const turning = [...rows].sort((a, b) => b.rawEngineLoss - a.rawEngineLoss)[0];

  const match = reviewData.openingMatch;
  $('review-opening-name').textContent = match.opening
    ? match.opening.name
    : 'Unknown opening';
  $('review-book-depth').textContent =
    `${match.depth} matched book ${match.depth === 1 ? 'ply' : 'plies'}`;

  if (turning) {
    $('review-turning-point').textContent = reviewMoveNotation(turning);
    $('review-turning-detail').textContent = turning.rawEngineLoss > 0
      ? `${turning.label} · ${turning.rawEngineLoss}cp swing`
      : 'No meaningful evaluation swing';
  }

  const phaseMarkup = ['opening','middlegame','endgame'].map(phase => {
    const phaseRows = rows.filter(row => row.phase === phase);
    const whiteRows = reviewRowsForSide(phaseRows, 'w');
    const blackRows = reviewRowsForSide(phaseRows, 'b');
    const whiteAccuracy = reviewPhaseAccuracyFor(whiteRows);
    const blackAccuracy = reviewPhaseAccuracyFor(blackRows);
    const range = phaseRows.length
      ? `${reviewMoveNotation(phaseRows[0]).split(' ')[0]}–${reviewMoveNotation(phaseRows[phaseRows.length - 1]).split(' ')[0]}`
      : 'Not detected';
    return `<article class="review-phase-card ${phaseRows.length ? '' : 'muted'}">
      <span>${reviewPhaseLabel(phase)}</span>
      <div class="review-phase-accuracy-pair">
        <div><small>${escapeHtml(reviewSideDisplayLabel('w'))}</small><strong>${whiteRows.length && whiteAccuracy != null ? `${whiteAccuracy}%` : ' - '}</strong></div>
        <div><small>${escapeHtml(reviewSideDisplayLabel('b'))}</small><strong>${blackRows.length && blackAccuracy != null ? `${blackAccuracy}%` : ' - '}</strong></div>
      </div>
      <small class="review-phase-range">${escapeHtml(range)}</small>
      <div class="review-phase-errors">
        <span><b>${escapeHtml(reviewSideDisplayLabel('w'))}:</b> ${escapeHtml(reviewErrorSummary(whiteRows))}</span>
        <span><b>${escapeHtml(reviewSideDisplayLabel('b'))}:</b> ${escapeHtml(reviewErrorSummary(blackRows))}</span>
      </div>
      <p>${escapeHtml(reviewPhaseSummary(phase, phaseRows))}</p>
    </article>`;
  }).join('');
  $('review-phase-grid').innerHTML = phaseMarkup;
  $('review-game-story').textContent = reviewData.story || '';
  $('review-event-timeline').innerHTML = (reviewData.events || []).map(event => `
    <button class="review-event" data-review-event-ply="${event.ply}">
      <span class="review-event-dot review-event-${event.type}"></span>
      <span><b>${escapeHtml(event.title)}</b><small>${escapeHtml(event.detail)}</small></span>
    </button>
  `).join('') || '<div class="review-event-empty">No major review events detected.</div>';
  $$('[data-review-event-ply]').forEach(button => button.addEventListener('click', () => {
    setReviewStep(Number(button.dataset.reviewEventPly));
    $('review-workspace-anchor')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));
}

function renderReviewMoveList() {
  const rows = reviewData.rows;
  const grouped = [];

  for (let index = 0; index < rows.length; index += 2) {
    grouped.push({
      turn: index / 2 + 1,
      white: rows[index],
      black: rows[index + 1]
    });
  }

  $('game-review-moves').innerHTML = grouped.map(group => `
    <div class="review-move-row">
      <span>${group.turn}.</span>
      ${reviewMoveButton(group.white)}
      ${reviewMoveButton(group.black)}
    </div>
  `).join('');

  $$('[data-review-step]').forEach(button => {
    button.addEventListener('click', () => setReviewStep(Number(button.dataset.reviewStep)));
  });
}

function reviewMoveButton(row) {
  if (!row) return '<button disabled></button>';
  return `
    <button data-review-step="${row.ply}"
            class="review-move-button review-${row.cls}"
            title="${escapeHtml(row.label)} · ${escapeHtml(reviewPhaseLabel(row.phase))}"
            aria-label="${escapeHtml(row.san)}: ${escapeHtml(row.label)}, ${escapeHtml(reviewPhaseLabel(row.phase))}">
      <b>${escapeHtml(row.san)}</b>
      <small>${reviewClassificationIcon(row.cls)}<span>${escapeHtml(reviewPhaseLabel(row.phase))}</span></small>
    </button>
  `;
}

function setReviewStep(step) {
  if (!reviewData) return;
  reviewStepIndex = Math.max(0, Math.min(reviewData.rows.length, step));
  clearReviewCoachAnnotations();
  updateReviewSelectedMove();
  paintGameReview();
}

function paintGameReview() {
  if (!reviewData) return;

  const fen = reviewStepIndex === 0
    ? reviewData.initialFen
    : reviewData.rows[reviewStepIndex - 1].fen;
  const board = fenBoard(fen);
  const ranks = reviewOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = reviewOrientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const selected = reviewStepIndex === 0 ? null : reviewData.rows[reviewStepIndex - 1];

  $('game-review-board').innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const row = 8 - rank;
      const col = file.charCodeAt(0) - 97;
      const square = `${file}${rank}`;
      const last = selected && (square === selected.from || square === selected.to);
      const symbol = board[row][col];
      const color = symbol
        ? (symbol === symbol.toUpperCase() ? 'white' : 'black')
        : '';
      return `<div class="${last ? 'review-last-square' : ''}"
                   data-square="${square}"
                   data-piece-color="${color}">${webPiece(symbol)}</div>`;
    })
  ).join('');
  syncBoardUserAnnotationPosition('game-review-board', `${fen}|${reviewOrientation}`);

  $$('[data-review-step]').forEach(button =>
    button.classList.toggle('active', Number(button.dataset.reviewStep) === reviewStepIndex)
  );

  paintReviewEvaluation(
    selected ? selected.whiteCp : reviewData.initialEval,
    selected ? selected.mate : reviewData.initialMate,
    selected?.terminal || null
  );
  updateReviewSelectedMove();

  $('review-start').disabled = reviewStepIndex === 0;
  $('review-prev').disabled = reviewStepIndex === 0;
  $('review-next').disabled = reviewStepIndex === reviewData.rows.length;
  $('review-end').disabled = reviewStepIndex === reviewData.rows.length;
}

function formatReviewEval(cp, mate) {
  if (mate != null) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`;
}

function reviewPositionDescription(cp = 0, mate = null) {
  if (mate != null) {
    return mate > 0
      ? `White has a forced mate in ${Math.abs(mate)}`
      : `Black has a forced mate in ${Math.abs(mate)}`;
  }

  const absolute = Math.abs(cp);
  const side = cp > 0 ? 'White' : cp < 0 ? 'Black' : '';

  if (absolute < 25) return 'Equal';
  if (absolute < 75) return `${side} is slightly better`;
  if (absolute < 160) return `${side} has a clear edge`;
  if (absolute < 300) return `${side} is much better`;
  return `${side} is winning`;
}

function paintReviewEvaluation(cp = 0, mate = null, terminal = null) {
  const bounded = terminal?.type === 'checkmate'
    ? (terminal.winner === 'w' ? 1000 : -1000)
    : mate != null
    ? (mate > 0 ? 1000 : -1000)
    : Math.max(-1000, Math.min(1000, cp));

  // Logistic scaling keeps small advantages visible without allowing a
  // large score to completely erase one side of the bar.
  const whitePercent = Math.max(
    4,
    Math.min(96, 100 / (1 + Math.exp(-bounded / 170)))
  );
  const blackPercent = 100 - whitePercent;
  const description = terminal?.type === 'checkmate'
    ? `${terminal.winner === 'w' ? 'White' : 'Black'} won by checkmate`
    : reviewPositionDescription(cp, mate);

  // Keep the side names stable. The evaluation has its own readout so mate
  // scores never disappear into or replace the Black/White labels.
  $('review-eval-top-label').textContent = reviewOrientation === 'white' ? 'Black' : 'White';
  $('review-eval-bottom-label').textContent = reviewOrientation === 'white' ? 'White' : 'Black';

  const value = $('review-eval-value-label');
  if (value) {
    const display = terminal?.type === 'checkmate'
      ? 'CHECKMATE'
      : mate != null
      ? `M${Math.abs(mate)}`
      : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`;
    value.textContent = display;

    const whiteFavored = terminal?.type === 'checkmate' ? terminal.winner === 'w' : (mate != null ? mate > 0 : cp >= 0);
    const favoredAtBottom = reviewOrientation === 'white' ? whiteFavored : !whiteFavored;
    value.classList.toggle('at-bottom', favoredAtBottom);
    value.classList.toggle('at-top', !favoredAtBottom);
    value.classList.toggle('on-white', favoredAtBottom);
    value.classList.toggle('on-black', !favoredAtBottom);
    value.title = description;
  }

  $('review-eval-white-zone').style.height = `${whitePercent}%`;
  $('review-eval-black-zone').style.height = `${blackPercent}%`;
  $('review-vertical-eval').setAttribute('aria-label', `${description}. Evaluation ${mate != null ? `mate in ${Math.abs(mate)}` : formatReviewEval(cp, null)}`);
  $('review-vertical-eval').title = description;
}

function reviewEvaluationCostLabel(loss = 0) {
  const cp = Math.max(0, Number(loss) || 0);
  if (cp <= 15) return 'negligible';
  if (cp <= 40) return 'small';
  if (cp <= 80) return 'modest';
  if (cp <= 150) return 'meaningful';
  if (cp <= 250) return 'large';
  return 'very large';
}

function reviewSelectedVerdict(row) {
  const phaseLabel = reviewPhaseLabel(row.phase);
  if (row.terminal?.type === 'checkmate') return `${phaseLabel}: ${row.san} delivered checkmate and ended the game.`;
  if (row.isBook) {
    return `${phaseLabel}: this move stayed inside BOZO's published opening line.`;
  }
  if (row.wasTop) {
    return `${phaseLabel}: this was the most precise move in the position.`;
  }

  const betterMove = row.engineBest && row.engineBest !== ' - ' ? row.engineBest : 'another continuation';
  const cost = reviewEvaluationCostLabel(row.rawEngineLoss);
  const position = reviewPositionDescription(row.whiteCp, row.mate).toLowerCase();
  return `${phaseLabel}: ${row.san} was playable, but ${betterMove} was the more precise continuation. The difference was ${cost}, and the resulting position is ${position}.`;
}

function reviewRecommendedLine(row) {
  if (row.isBook) return '';
  const line = (row.principalVariationSan || []).slice(0, 5).join(' ');
  if (!line) return '';
  return row.wasTop
    ? `Likely continuation: ${line}`
    : `Recommended line: ${line}`;
}



function reviewPieceWord(type) {
  return ({p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king'})[type] || 'piece';
}

function reviewMoveFacts(fen, san) {
  if (!fen || !san || san === ' - ') return null;
  try {
    const game = new Chess(fen);
    const move = game.move(san, { sloppy: true });
    if (!move) return null;
    const fromPiece = reviewPieceWord(move.piece);
    const captured = move.captured ? reviewPieceWord(move.captured) : null;
    const destination = move.to;
    const isCastle = move.san === 'O-O' || move.san === 'O-O-O';
    const isCheck = /[+#]$/.test(move.san);
    const isCapture = Boolean(move.captured) || move.san.includes('x');
    const isPromotion = Boolean(move.promotion);
    const isCenter = ['d4','e4','d5','e5'].includes(destination);
    const developsMinor =
      (move.piece === 'n' && ['b1','g1','b8','g8'].includes(move.from)) ||
      (move.piece === 'b' && ['c1','f1','c8','f8'].includes(move.from));
    const queenEarly = move.piece === 'q';
    return { ...move, fromPiece, captured, destination, isCastle, isCheck, isCapture, isPromotion, isCenter, developsMinor, queenEarly };
  } catch (_) {
    return null;
  }
}

function reviewDescribeMovePurpose(facts) {
  if (!facts) return '';
  const bits = [];
  if (facts.isCastle) {
    bits.push('gets the king to safety and connects the rooks');
  } else {
    if (facts.isCapture && facts.captured) bits.push(`removes the ${facts.captured} on ${facts.destination}`);
    if (facts.isCheck) bits.push('does so with tempo by checking the king');
    if (facts.developsMinor) bits.push(`develops the ${facts.fromPiece} from its starting square`);
    if (facts.isCenter && facts.piece === 'p') bits.push('claims central space');
    else if (facts.isCenter) bits.push('places a piece directly in the center');
    if (facts.isPromotion) bits.push(`promotes the pawn to a ${reviewPieceWord(facts.promotion)}`);
  }
  return bits.join(' and ');
}

function reviewConcreteComparison(row, best, pv) {
  if (!best || best === row.san || row.isBook) return '';
  const played = reviewMoveFacts(row.previousFen, row.san);
  const better = reviewMoveFacts(row.previousFen, best);
  if (!better) {
    return pv.length
      ? `${best} was the more precise continuation because it leads into ${pv.join(' ')} while keeping more control of the position.`
      : `${best} was the more precise continuation because it keeps more of the position's advantages intact.`;
  }

  const purpose = reviewDescribeMovePurpose(better);
  let reason = '';

  if (played && better.isCapture && played.isCapture && played.to === better.to && played.piece !== better.piece) {
    if (played.piece === 'q' && better.piece === 'p') {
      reason = `${best} recaptures on ${better.to} with the ${reviewPieceWord(better.piece)} instead of bringing the queen into the center early. That keeps the queen from becoming an easy target for development moves and uses the pawn to contest the center.`;
    } else {
      reason = `${best} handles the same capture with the ${reviewPieceWord(better.piece)} rather than the ${reviewPieceWord(played.piece)}, which leaves the other piece available for a more useful job.`;
    }
  } else if (better.isCastle) {
    reason = `${best} was more precise because it improves king safety immediately and brings the rooks closer to working together.`;
  } else if (better.developsMinor && !(played && played.developsMinor)) {
    reason = `${best} was more precise because it develops a new piece while ${row.san} does less to improve coordination.`;
  } else if (better.isCapture && better.captured) {
    reason = `${best} was more precise because it ${purpose || `wins material on ${better.to}`}, forcing the position to be resolved on favorable terms.`;
  } else if (better.isCheck) {
    reason = `${best} was more precise because it creates a forcing check, limiting the opponent's replies instead of giving them a free choice of plans.`;
  } else if (better.isCenter && !(played && played.isCenter)) {
    reason = `${best} was more precise because it ${purpose || 'improves central control'}, giving the position more space and influence over the key central squares.`;
  } else if (purpose) {
    reason = `${best} was more precise because it ${purpose}.`;
  } else {
    reason = `${best} was the more precise continuation because it keeps the position more coordinated and gives the opponent fewer useful replies.`;
  }

  if (pv.length) {
    const continuation = pv[0] === best ? pv.slice(1) : pv;
    if (continuation.length) {
      reason += ` One natural continuation is ${continuation.slice(0,4).join(' ')}, which shows the idea rather than just naming the move.`;
    }
  }
  return reason;
}


function reviewAuthoredOpeningExplanation(row) {
  if (!row?.isBook) return '';

  // Authored opening theory is the highest-authority source for book moves.
  // Never hide it merely because a generated/fallback note already exists.
  const cached = String(row.authorExplanation || '').trim();
  if (cached) return cached;

  const opening = reviewOpeningForPly(row.ply) || reviewData?.openingMatch?.opening;
  if (!opening) return '';

  const explanations =
    opening.author_explanations ||
    opening.metadata?.author_explanations ||
    opening.metadata?.authorExplanations ||
    {};

  return String(explanations?.[String(row.ply)] || explanations?.[row.ply] || '').trim();
}

function reviewAuthoredOpeningTakeaway(row) {
  if (!row?.isBook) return '';
  const cached = String(row.authorTakeaway || '').trim();
  if (cached) return cached;
  const opening = reviewOpeningForPly(row.ply) || reviewData?.openingMatch?.opening;
  const takeaways =
    opening?.author_takeaways ||
    opening?.metadata?.author_takeaways ||
    opening?.metadata?.authorTakeaways ||
    {};
  return String(takeaways?.[String(row.ply)] || takeaways?.[row.ply] || '').trim();
}

function reviewOpeningContext(row) {
  const exact = reviewOpeningNameForPly(row?.ply || 0);
  if (!exact.opening) return '';
  return [exact.name, exact.variation].filter(Boolean).join(': ');
}



let reviewTeachingGenerationToken = 0;

function reviewTeachingPayload(row, selectedIndex) {
  const exactOpening = reviewOpeningNameForPly(row.ply);
  const contextBeforeMoves = reviewData.rows
    .slice(Math.max(0, selectedIndex - 10), selectedIndex)
    .map(item => item.san);
  const actualContinuation = reviewData.rows
    .slice(selectedIndex + 1, selectedIndex + 9)
    .map(item => item.san);
  const gamePhase = row.phase || reviewGamePhase(row.ply, reviewData.rows.length, row.fen, reviewData.phasePlan);
  const facts = reviewVerifiedTeachingFacts(row, selectedIndex);
  const authored = reviewAuthoredOpeningExplanation(row);

  return {
    mode: 'game_review_auto_teaching',
    gameStatus: 'completed',
    fen: row.fen,
    previousFen: row.previousFen,
    playedMove: row.san,
    moveNumber: Math.ceil(row.ply / 2),
    opening: exactOpening.name,
    variation: exactOpening.variation || 'Main line / current position',
    exactOpeningPly: row.ply,
    gamePhase,
    contextBeforeMoves,
    contextBeforeText: reviewHistoryToMoveText(contextBeforeMoves),
    actualContinuation,
    moveHistory: reviewData.rows.slice(0, row.ply).map(item => item.san),
    evaluationBefore: selectedIndex > 0 ? reviewData.rows[selectedIndex - 1].whiteCp : 0,
    evaluationAfter: row.whiteCp,
    bestMove: row.engineBest,
    bestMoveFen: row.bestMoveFen,
    principalVariation: row.principalVariation,
    principalVariationSan: row.principalVariationSan,
    classification: row.label,
    centipawnLoss: row.rawEngineLoss,
    moveAccuracy: Math.round(row.accuracy * 10) / 10,
    verifiedBoardFacts: facts,
    authoredTeachingExample: authored || null,
    question: [
      `Write the ready-to-display teaching note for ${reviewMoveNotation(row)}.`,
      `Explain THIS move in THIS position, not the opening in general.`,
      exactOpening.name !== 'Unknown opening'
        ? `The opening context at this exact ply is ${exactOpening.name}${exactOpening.variation ? `: ${exactOpening.variation}` : ''}.`
        : `Do not invent an opening name if the position is not clearly identified.`,
      authored
        ? `Use this existing BOZO authored note as a knowledge/style example when relevant: "${authored}"`
        : `There is no authored note for this exact ply, so derive the explanation from known chess principles, the board, the game context, and the supplied continuation.`,
      row.isBook
        ? `Because this is a book move, explain its concrete purpose, what it prepares, which squares, pieces, or pawn breaks matter, and how it connects to the next moves. Never say only "follow the plan" or "known opening move."`
        : `Explain what the played move accomplishes, what it misses if anything, and why the more precise continuation is stronger. Do not merely name the alternative.`,
      `Use natural chess-coach language. Never say "the engine preferred."`,
      `FACTUAL GROUNDING IS MANDATORY: every concrete square, piece location, attack, weakness, opened line, capture, or threat must be supported by verifiedBoardFacts.`,
      `Never invent "loosened squares", "weak squares", holes, pins, attacks, threats, piece support, or diagonal/file control just because they sound plausible. If verifiedBoardFacts does not establish the claim, leave it out.`,
      `A useful explanation should answer at least two concrete questions when the facts allow it: what changed immediately, what move or placement it prepares, what opponent idea it answers, or how it connects to the actual next moves.`,
      `Do not pad with generic praise such as "improves development" unless you name the actual piece, square, or castling consequence that makes that true.`,
      `For future plans, use prepares/aims/plans language and tie the claim to a legal follow-up, actualContinuation, authoredTeachingExample, or principalVariation.`,
      `Do not mention missing metadata, missing authored notes, databases, prompts, or internal implementation.`,
      `Keep the main explanation to roughly 2-4 useful sentences, then give one concise practical takeaway.`
    ].join(' '),
    strictGrounding: true
  };
}


function reviewStructuredMoveAnalysis(row, selectedIndex) {
  const facts = reviewVerifiedTeachingFacts(row, selectedIndex);
  const move = facts?.moveFacts || {};
  move.piece = move.pieceCode || ({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'})[String(move.piece||'').toLowerCase()] || move.piece;
  move.captured = move.capturedCode || ({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'})[String(move.captured||'').toLowerCase()] || move.captured;
  move.promotion = move.promotionCode || ({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'})[String(move.promotion||'').toLowerCase()] || move.promotion;
  const exact = reviewOpeningNameForPly(row.ply);
  const before = facts?.beforePieces || {};
  const after = facts?.afterPieces || {};
  const movedPiece = move.to ? after[move.to] : null;
  const pieceName = movedPiece ? COACH_PIECE_NAMES[movedPiece.type] : 'piece';
  const sideName = row.mover === 'w' ? 'White' : 'Black';
  const opponent = row.mover === 'w' ? 'Black' : 'White';

  const immediateEffects=[], preparedMoves=[], developmentGoals=[], secondaryIdeas=[], gameConnections=[], forbidden=[];
  let primaryIdea='';

  // chess.js calls every geometrically attacked square an "attack". For teaching,
  // split that into empty squares CONTROLLED and occupied enemy pieces ATTACKED.
  const controlledSquares=[];
  const attackedPieces=[];
  for (const sq of (facts?.movedPieceAttacks || [])) {
    const target=after[sq];
    if (target && movedPiece && target.color !== movedPiece.color) {
      attackedPieces.push({square:sq,piece:COACH_PIECE_NAMES[target.type] || 'piece'});
    } else if (!target) {
      controlledSquares.push(sq);
    }
  }

  if (move.from && move.to) immediateEffects.push(`${sideName} moves the ${pieceName} from ${move.from} to ${move.to}.`);
  if (move.captured) immediateEffects.push(`It captures the ${COACH_PIECE_NAMES[move.captured] || 'piece'} on ${move.to}.`);
  if (move.isCheck) immediateEffects.push(`It gives check.`);
  if (move.isCastle) {
    primaryIdea=`Castle the king and connect the rook to the game.`;
    developmentGoals.push(`King safety and rook activation.`);
  }
  if (controlledSquares.length && move.piece !== 'b') secondaryIdeas.push(`The ${pieceName} on ${move.to} controls ${controlledSquares.join(', ')}.`);
  if (controlledSquares.length && move.piece === 'b') secondaryIdeas.push(`The bishop on ${move.to} is active along its diagonal.`);
  if (attackedPieces.length) immediateEffects.push(`It attacks ${attackedPieces.map(x=>`${opponent}'s ${x.piece} on ${x.square}`).join(' and ')}.`);

  // Pawn moves that free a bishop: this is often the PURPOSE, not a footnote.
  if (move.piece === 'p') {
    const bishopPrep={
      b3:{bishop:'c1',dest:'b2'}, g3:{bishop:'f1',dest:'g2'},
      b6:{bishop:'c8',dest:'b7'}, g6:{bishop:'f8',dest:'g7'},
      b4:{bishop:'c1',dest:'b2'}, g4:{bishop:'f1',dest:'g2'},
      b5:{bishop:'c8',dest:'b7'}, g5:{bishop:'f8',dest:'g7'}
    }[move.to];
    if (bishopPrep) {
      const bishop=after[bishopPrep.bishop];
      // Verify the pawn really vacated the bishop's intended development square.
      // Do NOT use Chess(row.fen).moves() here: after the pawn move it is the
      // opponent's turn, so chess.js will never list the mover's bishop move.
      const beforeDest=before[bishopPrep.dest];
      const afterDest=after[bishopPrep.dest];
      const pawnVacatedDest = beforeDest?.type==='p' && beforeDest.color===row.mover && !afterDest;
      if (bishop?.type==='b' && bishop.color===row.mover && pawnVacatedDest) {
        const prepSan = `B${bishopPrep.dest}`;
        preparedMoves.push(prepSan);
        developmentGoals.push(`Develop the bishop from ${bishopPrep.bishop} to ${bishopPrep.dest}.`);
        primaryIdea=`Prepare ${prepSan}, developing the bishop from ${bishopPrep.bishop} to ${bishopPrep.dest}.`;
      }
    }
  }

  // A bishop leaving its home square is itself a development goal. Describe its
  // real ray, but don't confuse an empty square with an attacked piece.
  if (move.piece==='b' && move.from && move.to) {
    const homeBishops=['c1','f1','c8','f8'];
    if (homeBishops.includes(move.from)) {
      developmentGoals.push(`Develop the bishop from ${move.from} to ${move.to}.`);
      if (!primaryIdea) primaryIdea=`Develop the bishop to ${move.to} and use its diagonal from there.`;
    }
  }

  // Knight development from the back rank: teach development + real central influence.
  if (move.piece==='n' && ['b1','g1','b8','g8'].includes(move.from)) {
    developmentGoals.push(`Develop the knight from ${move.from} to ${move.to}.`);
    const centralKnightSquares=controlledSquares.filter(sq=>['d4','e4','d5','e5'].includes(sq));
    if (!primaryIdea) primaryIdea=`Develop the knight to ${move.to}${centralKnightSquares.length ? ` and influence the center` : ''}.`;
  }

  // Actual continuation is context. If the very next move realizes a prepared
  // move, that strongly confirms the teaching priority without claiming causation.
  const next=facts?.actualNextMoves || [];
  if(next.length) gameConnections.push(`The game continued ${next.join(' ')}.`);
  if(preparedMoves.length && next.some(san=>preparedMoves.includes(String(san).replace(/[+#?!]/g,'')))) {
    gameConnections.push(`The prepared development idea is realized immediately in the game.`);
  }

  if(exact?.name && exact.name!=='Unknown opening')
    gameConnections.push(`At this exact ply the line is ${exact.name}${exact.variation?`: ${exact.variation}`:''}.`);

  // If no stronger purpose was verified, fall back to the most educational
  // concrete fact, in priority order.
  if(!primaryIdea && attackedPieces.length) primaryIdea=`Create immediate pressure on ${attackedPieces.map(x=>x.square).join(', ')}.`;
  if(!primaryIdea && move.captured) primaryIdea=`Make the concrete capture on ${move.to}.`;
  if(!primaryIdea && move.piece==='b' && controlledSquares.length) primaryIdea=`Improve the bishop's activity along its diagonal from ${move.to}.`;
  if(!primaryIdea && controlledSquares.length) {
    if(move.piece==='p') primaryIdea=`Use the pawn on ${move.to} to claim space and control nearby squares.`;
    else if(move.piece==='n') primaryIdea=`Improve the knight's placement and influence useful squares from ${move.to}.`;
    else primaryIdea=`Improve the ${pieceName}'s activity from ${move.to}.`;
  }
  if(!primaryIdea) primaryIdea=`Improve the piece placement with ${row.san}.`;

  if(move.piece==='p' && move.to) {
    forbidden.push(`Do not say the pawn on ${move.to} attacks a piece unless an enemy piece actually occupies one of its capture squares.`);
    forbidden.push(`Empty pawn capture squares are controlled squares, not attacked pieces.`);
  }
  forbidden.push('Do not invent weak squares, loosened squares, holes, pins, threats, targets, or strategic relationships not present in the structured facts.');
  forbidden.push('Do not infer that one move caused a later move merely because it appears in the continuation.');

  return {
    move:reviewMoveNotation(row), classification:row.label,
    openingAtThisPly:exact?.name||'Unknown opening', variationAtThisPly:exact?.variation||'',
    primaryIdea, secondaryIdeas, developmentGoals, preparedMoves,
    controlledSquares, attackedPieces,
    immediateEffects, verifiedConnections:gameConnections,
    verifiedNewlyOpenedLines:facts?.newlyOpenedLines||[],
    actualContinuation:next, principalVariation:row.principalVariationSan||[],
    alternativeAnalysis:(()=>{
      const second=row.choiceLines?.[1];
      let san='';
      try{if(second?.pv?.[0]) san=reviewUciToSan(row.previousFen,second.pv[0]);}catch(_){}
      return san ? {move:san,whyItFails:reviewExplainWhyAlternativeFails(row,san,second?.pv||[])} : null;
    })(),
    forbiddenClaims:forbidden, rawVerifiedFacts:facts
  };
}



function reviewPassedPawnInfo(row, structure) {
  const move=structure?.rawVerifiedFacts?.moveFacts||{};
  const pieceCode=move.pieceCode || move.piece;
  if(pieceCode!=='p' || !move.to) return null;
  const pieces=structure?.rawVerifiedFacts?.afterPieces||{};
  const mover=row.mover;
  const enemy=mover==='w'?'b':'w';
  const file=move.to.charCodeAt(0)-97;
  const rank=Number(move.to[1]);

  for(const [sq,p] of Object.entries(pieces)){
    if(p?.type!=='p' || p?.color!==enemy) continue;
    const ef=sq.charCodeAt(0)-97, er=Number(sq[1]);
    if(Math.abs(ef-file)>1) continue;
    if(mover==='w' ? er>rank : er<rank) return null;
  }

  const promotionSquare=move.to[0] + (mover==='w'?'8':'1');
  const pushesToPromote=mover==='w' ? 8-rank : rank-1;
  return {square:move.to,promotionSquare,pushesToPromote,advanced:pushesToPromote<=2};
}

function reviewPvMaterialSwing(row) {
  try {
    const pv=Array.isArray(row?.principalVariation)?row.principalVariation.slice(0,8):[];
    if(!pv.length || !row?.previousFen) return null;
    const g=new Chess(row.previousFen);
    const opponent=row.mover==='w'?'b':'w';
    const countRooks=fen=>{
      const b=parseFenBoard(fen);
      return Object.values(b).filter(p=>p.color===opponent && p.type==='r').length;
    };
    const opponentRooksBefore=countRooks(row.previousFen);
    let opponentRooksAfter=opponentRooksBefore;
    let promoted=false;
    let promotionMove='';
    for(const u0 of pv){
      const u=String(u0||'').toLowerCase();
      const legal=g.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===u);
      if(!legal) break;
      const moved=g.move(legal);
      if(moved?.promotion && moved.color===row.mover){
        promoted=true;
        promotionMove=moved.san;
      }
      opponentRooksAfter=Math.min(opponentRooksAfter,countRooks(g.fen()));
    }
    return {
      promoted,
      promotionMove,
      opponentRookLost: opponentRooksAfter < opponentRooksBefore
    };
  } catch (_) {
    return null;
  }
}


function reviewMaterialVector(fen, side) {
  const board=parseFenBoard(fen);
  const out={p:0,n:0,b:0,r:0,q:0,k:0};
  for(const p of Object.values(board)) if(p.color===side && out[p.type]!=null) out[p.type]++;
  return out;
}

function reviewContinuationConsequences(row,{fromBefore=false,maxPlies=10}={}) {
  try {
    const startFen=fromBefore ? row.previousFen : row.fen;
    const pv=fromBefore ? (row.principalVariation||[]) : (row.replyVariation||[]);
    if(!startFen || !pv.length) return null;

    const g=new Chess(startFen);
    const mine=row.mover, enemy=mine==='w'?'b':'w';
    const beforeMine=reviewMaterialVector(startFen,mine);
    const beforeEnemy=reviewMaterialVector(startFen,enemy);
    let promoted=false, deliveredMate=false;
    let lastSan='';
    for(const u0 of pv.slice(0,maxPlies)){
      const u=String(u0||'').toLowerCase();
      const legal=g.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===u);
      if(!legal) break;
      const moved=g.move(legal);
      lastSan=moved?.san||lastSan;
      if(moved?.promotion && moved.color===mine) promoted=true;
      if(reviewIsCheckmate(g)) { deliveredMate=true; break; }
    }
    const afterMine=reviewMaterialVector(g.fen(),mine);
    const afterEnemy=reviewMaterialVector(g.fen(),enemy);
    const lost=(before,after)=>({
      q:Math.max(0,before.q-after.q),
      r:Math.max(0,before.r-after.r),
      b:Math.max(0,before.b-after.b),
      n:Math.max(0,before.n-after.n),
      p:Math.max(0,before.p-after.p)
    });
    return {
      mineLost:lost(beforeMine,afterMine),
      enemyLost:lost(beforeEnemy,afterEnemy),
      promoted,
      deliveredMate,
      lastSan,
      finalFen:g.fen()
    };
  } catch (_) { return null; }
}

function reviewMaterialLossPhrase(loss={}) {
  const pieces=[];
  const add=(count,name)=>{for(let i=0;i<count;i++)pieces.push(name)};
  add(loss.q||0,'queen');add(loss.r||0,'rook');add(loss.b||0,'bishop');add(loss.n||0,'knight');add(loss.p||0,'pawn');
  if(!pieces.length) return '';
  if(pieces.length===1) return `a ${pieces[0]}`;
  if(pieces.length===2) return `a ${pieces[0]} and a ${pieces[1]}`;
  return pieces.map((x,i)=>`${i===pieces.length-1?'and ':''}a ${x}`).join(', ').replace(', and ',' and ');
}


// Review is allowed to USE engine analysis, but the learner should only see chess.
// This final presentation guard prevents implementation vocabulary from leaking out
// of local templates or AI-written upgrades.
function reviewCoachFacingText(value='') {
  let text=String(value||'');
  text=text
    .replace(/Stockfish(?:'s|’s)\s+second choice/gi,'The strongest alternative')
    .replace(/Stockfish(?:'s|’s)\s+(?:winning\s+)?continuation/gi,'the forcing continuation')
    .replace(/(?:the\s+)?engine(?:'s|’s)?\s+(?:best\s+)?continuation/gi,'the best continuation')
    .replace(/(?:the\s+)?engine\s+(?:preferred|prefers|recommends|recommended)/gi,'the position favors')
    .replace(/(?:the\s+)?principal variation\s+shows/gi,'The continuation shows')
    .replace(/(?:the\s+)?principal variation\s+confirms/gi,'The continuation confirms')
    .replace(/(?:the\s+)?principal variation\s+demonstrates/gi,'The continuation demonstrates')
    .replace(/\bprincipal variation\b/gi,'continuation')
    .replace(/\bengine line\b/gi,'continuation')
    .replace(/\bengine evaluation\b/gi,'evaluation')
    .replace(/\bStockfish\b/gi,'the analysis');
  // The replacements above are a safety net. No coach-facing template should rely
  // on them as its primary explanation.
  return text.replace(/\s{2,}/g,' ').trim();
}

function reviewPositionKey(fen='') {
  return String(fen||'').split(' ').slice(0,4).join(' ');
}

function reviewHalfmoveClock(fen='') {
  const n=Number(String(fen||'').split(' ')[4]||0);
  return Number.isFinite(n)?n:0;
}

function reviewAttackersOfSquare(board, square, color) {
  const out=[];
  for(const [from,piece] of Object.entries(board||{})){
    if(piece.color!==color) continue;
    if(attackedSquaresForPiece(from,piece,board).includes(square)) out.push({from,piece:piece.type});
  }
  return out;
}

function reviewLoosePieces(fen, side) {
  const board=parseFenBoard(fen);
  const enemy=side==='w'?'b':'w';
  const values={p:1,n:3,b:3,r:5,q:9,k:100};
  const loose=[];
  for(const [square,piece] of Object.entries(board)){
    if(piece.color!==side || piece.type==='k') continue;
    const attackers=reviewAttackersOfSquare(board,square,enemy);
    if(!attackers.length) continue;
    const defenders=reviewAttackersOfSquare(board,square,side).filter(x=>x.from!==square);
    if(!defenders.length) loose.push({square,piece:piece.type,value:values[piece.type]||0,attackers});
  }
  return loose.sort((a,b)=>b.value-a.value);
}

function reviewBranchHistoryCounts(row) {
  const counts=new Map();
  const add=fen=>{const k=reviewPositionKey(fen);if(k)counts.set(k,(counts.get(k)||0)+1)};
  add(reviewData?.initialFen || new Chess().fen());
  for(const r of reviewData?.rows||[]){
    if(r.ply>=row.ply) break;
    add(r.fen);
  }
  return counts;
}

function reviewAnalyzeAlternative(row, alternativeSan='', lineUci=[]) {
  if(!row?.previousFen || !alternativeSan) return null;
  try{
    const g=new Chess(row.previousFen);
    const alt=g.move(alternativeSan,{sloppy:true});
    if(!alt) return null;
    const altFen=g.fen();
    const mover=row.mover, enemy=mover==='w'?'b':'w';
    const altFacts=reviewMoveFacts(row.previousFen,alt.san);
    const playedFacts=reviewMoveFacts(row.previousFen,row.san);
    const counts=reviewBranchHistoryCounts(row);
    const addRep=()=>{const k=reviewPositionKey(g.fen());counts.set(k,(counts.get(k)||0)+1);return counts.get(k)};
    let repetitionCount=addRep();
    let forcedDraw='';
    let deliveredMate=false;
    let mateWinner='';
    let plies=0;
    const beforeMine=reviewMaterialVector(row.previousFen,mover);
    const beforeEnemy=reviewMaterialVector(row.previousFen,enemy);
    const pv=Array.isArray(lineUci)?lineUci.slice():[];
    // MultiPV includes the alternative itself as pv[0]. We already played it.
    if(pv.length && String(pv[0]).toLowerCase()===reviewMoveUci(alt).toLowerCase()) pv.shift();
    for(const u0 of pv.slice(0,12)){
      const u=String(u0||'').toLowerCase();
      const legal=g.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===u);
      if(!legal) break;
      const moved=g.move(legal); plies++;
      repetitionCount=Math.max(repetitionCount,addRep());
      if(reviewIsCheckmate(g)){deliveredMate=true;mateWinner=moved.color;break;}
      if(reviewIsStalemate(g)){forcedDraw='stalemate';break;}
      if(reviewIsInsufficient(g)){forcedDraw='insufficient material';break;}
      if(repetitionCount>=3){forcedDraw='threefold repetition';break;}
      if(reviewHalfmoveClock(g.fen())>=100){forcedDraw='fifty-move rule';break;}
    }
    const afterMine=reviewMaterialVector(g.fen(),mover), afterEnemy=reviewMaterialVector(g.fen(),enemy);
    const lost=(a,b)=>({q:Math.max(0,a.q-b.q),r:Math.max(0,a.r-b.r),b:Math.max(0,a.b-b.b),n:Math.max(0,a.n-b.n),p:Math.max(0,a.p-b.p)});
    const chosenLoose=reviewLoosePieces(row.fen,mover);
    const altLoose=reviewLoosePieces(altFen,mover);
    const newlyLoose=altLoose.filter(x=>!chosenLoose.some(y=>y.square===x.square&&y.piece===x.piece));
    return {
      san:alt.san, altFen, playedFacts, altFacts, plies, deliveredMate, mateWinner, forcedDraw,
      repetitionCount, fiftyMoveDormant:reviewHalfmoveClock(altFen)>=90,
      mineLost:lost(beforeMine,afterMine), enemyLost:lost(beforeEnemy,afterEnemy),
      newlyLoose, finalFen:g.fen()
    };
  }catch(_){return null;}
}

function reviewExplainWhyAlternativeFails(row, alternativeSan='', lineUci=[]) {
  const a=reviewAnalyzeAlternative(row,alternativeSan,lineUci);
  if(!a) return '';
  const parts=[];
  const myLoss=reviewMaterialLossPhrase(a.mineLost||{});
  const enemyLoss=reviewMaterialLossPhrase(a.enemyLost||{});
  const played=a.playedFacts, alt=a.altFacts;

  if(a.deliveredMate && a.mateWinner && a.mateWinner!==row.mover){
    parts.push(`${a.san} fails concretely because the opponent can force checkmate.`);
  } else if(a.forcedDraw){
    parts.push(`${a.san} allows a forced draw by ${a.forcedDraw}, so it gives up the winning chances that ${row.san} preserves.`);
  } else if(myLoss){
    parts.push(`${a.san} allows the opponent to win ${myLoss} in the forcing continuation.`);
  } else if(a.newlyLoose?.length){
    const x=a.newlyLoose[0];
    parts.push(`${a.san} leaves the ${COACH_PIECE_NAMES[x.piece]} on ${x.square} attacked without a defender, giving the opponent an immediate target.`);
  }

  if(played?.isCheck && !alt?.isCheck){
    parts.push(`${row.san} comes with check, so the opponent must answer the king threat first; ${a.san} gives up that forcing tempo and lets the opponent act immediately.`);
  } else if(played?.isCapture && !alt?.isCapture && played?.captured){
    parts.push(`${row.san} immediately removes the ${played.captured} on ${played.to}, while ${a.san} leaves that resource on the board.`);
  }

  if(a.repetitionCount===2 && !a.forcedDraw){
    parts.push(`The repetition is also dormant rather than claimable: this branch has reached the same position twice, so another recurrence would create a threefold draw.`);
  }
  if(a.fiftyMoveDormant && !a.forcedDraw){
    parts.push(`The fifty-move counter is already close to the draw threshold, so wasting tempi also carries a concrete draw risk.`);
  }
  if(!parts.length && enemyLoss && !myLoss){
    parts.push(`${a.san} does not create the same forcing sequence; ${row.san} is the move that converts the position before the opponent can reorganize.`);
  }
  return parts.slice(0,3).join(' ');
}

function reviewGreatBrilliantTeaching(row,structure) {
  const cls=String(row?.cls||'').toLowerCase();
  if(cls!=='great' && cls!=='brilliant') return null;
  const second=row.choiceLines?.[1];
  let secondSan='';
  try { if(second?.pv?.[0]) secondSan=reviewUciToSan(row.previousFen,second.pv[0]); } catch(_) {}
  const alternativeWhy=secondSan ? reviewExplainWhyAlternativeFails(row,secondSan,second?.pv||[]) : '';

  if(cls==='brilliant'){
    const consequence=reviewContinuationConsequences(row,{fromBefore:true,maxPlies:10});
    const myLoss=reviewMaterialLossPhrase(consequence?.mineLost||{});
    let why=`${row.san} is brilliant because it preserves the position while allowing a sound material sacrifice${myLoss?` involving ${myLoss}`:''}.`;
    if(alternativeWhy) why+=` ${alternativeWhy}`;
    else if(secondSan) why+=` The strongest alternative, ${secondSan}, does not preserve the same result.`;
    return {why:reviewCoachFacingText(why),lesson:'A sound sacrifice is justified by what remains after the material is given up. Calculate the forcing replies, compensation, and final result rather than judging the move by material alone.'};
  }

  let why=`${row.san} is a Great move because it is the only move that preserves the advantage or saves the game.`;
  if(alternativeWhy) why+=` ${alternativeWhy}`;
  else if(secondSan) why+=` The strongest alternative, ${secondSan}, gives away that result, although this short continuation does not expose a single simpler tactical cause.`;
  return {why:reviewCoachFacingText(why),lesson:'In critical positions, identify the position’s urgent requirement, then compare what the natural alternatives actually allow after the opponent’s forcing reply.'};
}

function reviewPromotionTeaching(row, structure) {
  const info=reviewPassedPawnInfo(row,structure);
  if(!info?.advanced) return null;

  const pvEffect=reviewPvMaterialSwing(row);
  const consequence=reviewContinuationConsequences(row,{fromBefore:true,maxPlies:10});
  const enemyLoss=reviewMaterialLossPhrase(consequence?.enemyLost||{});
  let why=`${row.san} makes the passed pawn the position's most urgent feature. On ${info.square} it is only ${info.pushesToPromote} push${info.pushesToPromote===1?'':'es'} from ${info.promotionSquare}=Q, so the defender has to organize everything around stopping promotion.`;

  if(consequence?.enemyLost?.r>0 || pvEffect?.opponentRookLost){
    why += ` The threat cannot be stopped cleanly: in the forcing continuation the defending rook is lost while trying to contain the pawn, so the passer converts into decisive material even if it does not queen immediately.`;
  } else if(enemyLoss){
    why += ` The continuation shows the defender giving up ${enemyLoss} to contain the pawn, so the promotion threat converts directly into material.`;
  } else if(consequence?.promoted || pvEffect?.promoted){
    why += ` The continuation confirms that the pawn reaches promotion, so this is a concrete queening plan rather than a vague space gain.`;
  }

  const lesson='An advanced passed pawn can become more important than material elsewhere. Calculate its direct promotion route first, then check whether the defender must sacrifice material to stop it.';
  return {why,lesson,info,pvEffect};
}

function reviewLessonIsGeneric(text='') {
  const t=String(text||'').trim().toLowerCase();
  if(!t) return true;
  return [
    /^remember (the|what|that)/,
    /main purpose of .* and how it fits/,
    /what the move actually accomplished/,
    /not just (that|the)/,
    /connect this move to the next/,
    /ask what square, pawn break/,
    /more precise continuation/,
    /remember the main purpose/,
    /this move belongs to/
  ].some(rx=>rx.test(t));
}

function reviewPawnIsPassedAfterMove(row, structure) {
  const move=structure?.rawVerifiedFacts?.moveFacts||{};
  if((move.pieceCode||move.piece)!=='p' || !move.to) return false;
  const pieces=structure?.rawVerifiedFacts?.afterPieces||{};
  const file=move.to.charCodeAt(0)-97, rank=Number(move.to[1]);
  const enemy=row.mover==='w'?'b':'w';
  for(const [sq,p] of Object.entries(pieces)){
    if(p?.type!=='p' || p?.color!==enemy) continue;
    const ef=sq.charCodeAt(0)-97, er=Number(sq[1]);
    if(Math.abs(ef-file)>1) continue;
    if(row.mover==='w' ? er>rank : er<rank) return false;
  }
  return true;
}

function reviewTransferableLesson(row, s) {
  const move=s?.rawVerifiedFacts?.moveFacts||{};
  move.piece = move.pieceCode || ({pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'})[String(move.piece||'').toLowerCase()] || move.piece;
  const central=(s?.controlledSquares||[]).filter(x=>['d4','e4','d5','e5'].includes(x));

  if(row?.terminal?.type==='checkmate')
    return 'When a forced finish is available, calculate checks first and verify whether the opponent has any legal escape.';

  if(move.piece==='p' && reviewPawnIsPassedAfterMove(row,s)){
    const rank=Number(move.to?.[1]||0);
    const advanced=row.mover==='w' ? rank>=6 : rank<=3;
    if(advanced)
      return 'An advanced passed pawn can outweigh slower positional goals. Calculate its direct route to promotion before looking for quieter improvements.';
    return 'Passed pawns become stronger as they advance. Before choosing a slower plan, calculate whether pushing the passer creates a concrete promotion threat.';
  }

  if(move.piece==='p' && s?.preparedMoves?.length)
    return 'A flank pawn move can also help development when advancing it clears a useful square or line for a piece. Judge the pawn move by both jobs, not by space alone.';

  if(move.piece==='n' && ['b1','g1','b8','g8'].includes(move.from)){
    if(central.length)
      return 'Early development is strongest when one move improves a piece and influences the center while keeping the pawn structure flexible.';
    return 'In the opening, prefer development that improves a piece without creating an unnecessary pawn commitment.';
  }

  if(move.piece==='b' && ['c1','f1','c8','f8'].includes(move.from)){
    if(['b2','g2','b7','g7'].includes(move.to))
      return 'When a pawn move opens a long diagonal, developing the bishop promptly lets the pawn advance serve a second purpose.';
    return 'Development is not just leaving the back rank. Put the bishop on a diagonal where it has a useful job in the position.';
  }

  if(move.isCastle)
    return 'Castling is most valuable when it solves two jobs at once: king safety and rook activation.';

  if(move.isCapture && move.captured)
    return 'Before making a capture, compare the resulting piece activity and the opponent’s recaptures, not just the material removed.';

  if(move.isCheck)
    return 'Checks are forcing moves, but their value comes from what they achieve after the forced reply. Calculate the follow-up before giving the check.';

  // Great/Brilliant have a real transferable decision-making lesson even when
  // the position does not expose a clean structural motif.
  if(String(row?.cls||'').toLowerCase()==='great')
    return 'When one move preserves the advantage and every alternative gives it away, identify the position’s urgent requirement before considering optional improvements.';
  if(String(row?.cls||'').toLowerCase()==='brilliant')
    return 'A sound sacrifice is justified by the position after the material is given up. Calculate the compensation concretely instead of judging the move by material alone.';

  // No verified reusable principle is better than filler.
  return '';
}

function reviewLessonCandidateIsUseful(candidate, summary='') {
  const lesson=String(candidate||'').trim();
  if(!lesson || reviewLessonIsGeneric(lesson) || lesson.length<45) return false;
  const a=lesson.toLowerCase().replace(/[^a-z0-9 ]/g,' ');
  const b=String(summary||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ');
  if(b && (a===b || b.includes(a) || a.includes(b))) return false;
  return true;
}

function reviewDeterministicTeachingFromStructure(row, s) {
  const promotionTeaching=reviewPromotionTeaching(row,s);
  if(promotionTeaching){
    return {
      summary:promotionTeaching.why,
      takeaway:promotionTeaching.lesson,
      source:'structured-local',
      structure:s,
      promotionTeaching
    };
  }

  const specialTeaching=reviewGreatBrilliantTeaching(row,s);
  if(specialTeaching){
    return {
      summary:specialTeaching.why,
      takeaway:specialTeaching.lesson,
      source:'structured-local',
      structure:s,
      specialTeaching
    };
  }

  const side = row.mover === 'w' ? 'White' : 'Black';
  const move = s?.rawVerifiedFacts?.moveFacts || {};
  const piece = s?.rawVerifiedFacts?.afterPieces?.[move.to];
  const pieceName = piece ? (COACH_PIECE_NAMES[piece.type] || 'piece') : 'piece';
  const sentences=[];

  // Compose the verified fields into normal annotated-PGN prose. Internal labels
  // such as "primary idea" or raw fact fragments should never reach the reader.
  const prep=s.preparedMoves?.[0] || '';
  const dev=s.developmentGoals?.[0] || '';
  const central=(s.controlledSquares||[]).filter(x=>['d4','e4','d5','e5'].includes(x));
  const otherControlled=(s.controlledSquares||[]).filter(x=>!central.includes(x));

  // Polish-style flank pawn moves: development is the headline, space is useful context.
  if(move.piece==='p' && prep && /^(Bb2|Bg2|Bb7|Bg7)$/.test(prep)) {
    const wing=['a','b','c'].includes(String(move.to||'')[0]) ? 'queenside' : 'kingside';
    const bishopFrom=(s.developmentGoals?.[0]?.match(/from ([a-h][1-8])/)||[])[1];
    const bishopTo=(s.developmentGoals?.[0]?.match(/to ([a-h][1-8])/)||[])[1];
    sentences.push(`${side} advances the pawn to ${move.to}, gaining ${wing} space while clearing a development square for the bishop.`);
    if(bishopFrom && bishopTo) sentences.push(`The main idea is ${prep}: the bishop can develop from ${bishopFrom} to ${bishopTo} and become active from there.`);
    else sentences.push(`The main idea is to follow with ${prep} and bring the bishop into the game.`);
  } else if(move.piece==='n' && ['b1','g1','b8','g8'].includes(move.from)) {
    let first=`${side} develops the knight from ${move.from} to ${move.to}, bringing a minor piece into the game`;
    if(central.length) first+=` and controlling ${central.join(' and ')}`;
    first+='.';
    sentences.push(first);
    sentences.push(`This is useful early development because ${side} improves a piece without committing another pawn.`);
  } else if(move.piece==='b' && ['c1','f1','c8','f8'].includes(move.from)) {
    sentences.push(`${side} develops the bishop from ${move.from} to ${move.to}, bringing it off its starting square and into the game.`);
    if(s.attackedPieces?.length) sentences.push(`From ${move.to}, it attacks ${s.attackedPieces.map(x=>`${x.piece} on ${x.square}`).join(' and ')}.`);
    else if(s.controlledSquares?.length) {
      const fianchetto=['b2','g2','b7','g7'].includes(move.to);
      sentences.push(`From ${move.to}, the bishop becomes active on ${fianchetto ? 'the long diagonal' : 'its new diagonal'}.`);
    }
  } else if(move.isCastle) {
    sentences.push(`${side} castles, improving king safety while bringing the rook closer to the center of the game.`);
  } else {
    if(s.primaryIdea) sentences.push(String(s.primaryIdea).replace(/^Primary idea:\s*/i,'').replace(/\.$/, '')+'.');
    if(s.attackedPieces?.length) sentences.push(`The ${pieceName} on ${move.to} attacks ${s.attackedPieces.map(x=>`${x.piece} on ${x.square}`).join(' and ')}.`);
    const usefulCentral=(s.controlledSquares||[]).filter(x=>['d4','e4','d5','e5'].includes(x));
    if(usefulCentral.length) sentences.push(`It also influences the center by controlling ${usefulCentral.join(' and ')}.`);
  }

  const realized=s.verifiedConnections?.some(x=>/realized immediately/i.test(x));
  if(realized && prep) sentences.push(`In the game, ${prep} followed immediately, carrying out that development plan.`);

  const summary=sentences.filter(Boolean).slice(0,4).join(' ').trim() || `${row.san} is best understood from the concrete change it makes to the position; BOZO did not verify enough detail to add a more specific strategic claim.`;

  // The second box is not a recap. It must teach a principle that transfers to
  // another position. If BOZO cannot verify one, leave it out.
  const takeaway=reviewTransferableLesson(row,s);

  return {summary,takeaway,source:'structured-local',structure:s};
}

function reviewStructuredTeachingIsSafe(explanation,s) {
  if(!explanation) return false;
  const visible=JSON.stringify(explanation);
  if(/primary idea:|secondary ideas?:|development goals?:|prepared moves?:|concrete influence|the moved piece/i.test(visible)) return false;
  const mv=s?.rawVerifiedFacts?.moveFacts || {};
  if(/(?:[a-h][1-8][, ]+){3,}[a-h][1-8]/i.test(visible)) return false;
  return !reviewTeachingHasUnsupportedStrategicClaim(explanation,s.rawVerifiedFacts)
      && !reviewTeachingHasUnsupportedRelationship(explanation,s.rawVerifiedFacts);
}

async function generateReviewTeachingNote(row, selectedIndex, token) {
  if (!row || row.generatedTeachingNote || token !== reviewTeachingGenerationToken) return;

  const authored=reviewAuthoredOpeningExplanation(row);
  if(authored){
    const structure=reviewStructuredMoveAnalysis(row,selectedIndex);
    const authoredLesson=reviewAuthoredOpeningTakeaway(row);
    const derivedLesson=reviewTransferableLesson(row,structure);
    row.generatedTeachingNote={
      summary:authored,
      takeaway:reviewLessonCandidateIsUseful(authoredLesson,authored) ? authoredLesson : derivedLesson,
      source:'authored-opening',
      structure
    };
    if(reviewData?.rows?.[reviewStepIndex-1]===row) renderReviewAutoExplanation(row);
    return;
  }

  // Stage 1: deterministic chess analysis first.
  const structure=reviewStructuredMoveAnalysis(row,selectedIndex);
  const safeLocal=reviewDeterministicTeachingFromStructure(row,structure);
  row.generatedTeachingNote=safeLocal;
  if(reviewData?.rows?.[reviewStepIndex-1]===row) renderReviewAutoExplanation(row);
  if(!state.session?.user) return;

  try{
    // Stage 2: AI is only a prose writer over the verified structure.
    const payload={
      mode:'game_review_structured_writer',
      gameStatus:'completed', fen:row.fen, previousFen:row.previousFen,
      playedMove:row.san, moveNumber:Math.ceil(row.ply/2), classification:row.label,
      structuredAnalysis:{
        move:structure.move, openingAtThisPly:structure.openingAtThisPly,
        variationAtThisPly:structure.variationAtThisPly,
        primaryIdea:structure.primaryIdea,
        secondaryIdeas:structure.secondaryIdeas,
        developmentGoals:structure.developmentGoals,
        preparedMoves:structure.preparedMoves,
        controlledSquares:structure.controlledSquares,
        attackedPieces:structure.attackedPieces,
        immediateEffects:structure.immediateEffects,
        verifiedConnections:structure.verifiedConnections,
        verifiedNewlyOpenedLines:structure.verifiedNewlyOpenedLines,
        actualContinuation:structure.actualContinuation,
        principalVariation:structure.principalVariation,
        alternativeAnalysis:structure.alternativeAnalysis,
        forbiddenClaims:structure.forbiddenClaims
      },
      question:[
        `You are the teaching writer, not the chess analyst. structuredAnalysis is authoritative.`,
        `Write a move-specific coaching note for ${structure.move} in the style of a strong annotated opening course.`,
        `Lead with primaryIdea. The main purpose must never be buried under secondary geometry.`,
        `Then naturally connect concrete effects, development, pressure, preparation, or continuation when those fields support them.`,
        `Model the explanatory rhythm of high-quality annotated PGNs: say what the move does, why that matters here, and what idea it sets up or answers.`,
        `When a move follows a normal opening principle, name the concrete principle only when supported (development, center, king safety). When a move is unusual, explain the concrete reason only if supplied by the facts.`,
        `Distinguish chess terminology carefully: an empty square is controlled; an enemy piece on a reachable square is attacked. Never call an empty square an attacked piece.`,
        `For bishops, do not enumerate every empty square on a diagonal. Describe the bishop as active on the long diagonal (for b2, g2, b7, or g7) or on its diagonal, and only name a square when it contains a real target or is strategically necessary.`,
        `Do not repeat the same geometric fact in multiple sentences. Prefer one natural chess concept over a comma-separated square list.`,
        `Use actualContinuation to connect moves when useful, but do not pretend the later move was forced or caused unless the structure explicitly says so.`,
        `Use only claims explicitly supported by structuredAnalysis. Do not add chess facts from intuition, memory, or generic opening lore.`,
        `Do not invent support, attacks, weaknesses, diagonals, threats, plans, or causal relationships.`,
        `Never mention Stockfish, an engine, principal variations, MultiPV, centipawns, or internal analysis. Translate the evidence into chess causes.`,
        `For Great/Brilliant/critical moves, if alternativeAnalysis supplies whyItFails, explicitly explain WHY that alternative fails: material, mate, draw mechanism, hanging piece, lost tempo, or another verified consequence. Do not merely say it is worse.`,
        `Avoid robotic wording such as "the engine preferred", "concrete influence", "verified line", or "the moved piece". Name the pawn, knight, bishop, rook, queen, king, square, or plan directly.`,
        `Never dump a piece's full move map as a list of squares. Mention central squares only when strategically relevant; for bishops describe the diagonal, and for knights summarize central influence unless a specific occupied target matters.`,
        `Return 2-4 natural teaching sentences. If there is a genuinely reusable chess principle supported by the facts, also return one practical takeaway. The takeaway must transfer to other positions and must NOT restate this move, its destination, its classification, or the summary. If no reusable lesson is supported, return no takeaway.`,
        `Never mention structuredAnalysis, validation, metadata, prompts, databases, or implementation.`
      ].join(' '), strictGrounding:true
    };

    const {data,error}=await sb.functions.invoke('explain-move',{body:payload});
    if(error||data?.error||!data?.explanation||token!==reviewTeachingGenerationToken) return;
    const grounded=sanitizeCoachExplanation(data.explanation,structure.rawVerifiedFacts);
    if(!reviewStructuredTeachingIsSafe(grounded,structure)) return;

    const purpose=Array.isArray(grounded?.purpose)?grounded.purpose.filter(Boolean).join(' '):'';
    const chunks=[grounded?.summary,purpose,grounded?.whyItWorks,grounded?.connectionToOpening].map(v=>String(v||'').trim()).filter(Boolean);
    const unique=[];
    for(const chunk of chunks){
      const norm=chunk.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!unique.some(x=>{const n=x.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();return n===norm||n.includes(norm)||norm.includes(n)})) unique.push(chunk);
    }
    const summary=reviewCoachFacingText(unique.slice(0,3).join(' ').trim());
    const plans=Array.isArray(grounded?.practicalPlan)?grounded.practicalPlan.filter(Boolean):[];
    const candidateTakeaway=String(grounded?.keyLesson||grounded?.lesson||plans[0]||'').trim();
    // Prefer the deterministic transferable principle. The writer may improve it
    // only when the result is genuinely reusable and not a disguised recap.
    const takeaway=reviewLessonCandidateIsUseful(candidateTakeaway,summary)
      ? candidateTakeaway
      : safeLocal.takeaway;
    if(summary){
      const promotionTeaching=reviewPromotionTeaching(row,structure);
      const specialTeaching=reviewGreatBrilliantTeaching(row,structure);
      row.generatedTeachingNote=promotionTeaching
        ? {summary:promotionTeaching.why,takeaway:promotionTeaching.lesson,source:'structured-local',structure,promotionTeaching}
        : specialTeaching
          ? {summary:specialTeaching.why,takeaway:specialTeaching.lesson,source:'structured-local',structure,specialTeaching}
          : {summary,takeaway,source:'structured-writer',structure,full:grounded};
      if(reviewData?.rows?.[reviewStepIndex-1]===row) {
        renderReviewAutoExplanation(row);
        drawReviewAutomaticAnnotations(row);
      }
    }
  }catch(_){}
}

async function primeReviewTeachingNotes() {
  if (!reviewData?.rows?.length || !state.session?.user) return;
  const token = ++reviewTeachingGenerationToken;
  let cursor = 0;
  const worker = async () => {
    while (cursor < reviewData.rows.length && token === reviewTeachingGenerationToken) {
      const index = cursor++;
      await generateReviewTeachingNote(reviewData.rows[index], index, token);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

function reviewAutoExplanation(row) {
  if (!row) return null;

  if (row.generatedTeachingNote) {
    const exact = reviewOpeningNameForPly(row.ply);
    return {
      headline: `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san} — ${String(row.label || row.cls || 'Move')}`,
      why: reviewCoachFacingText(row.generatedTeachingNote.summary),
      comparison: '',
      comparisonLabel: '',
      lesson: reviewCoachFacingText(row.generatedTeachingNote.takeaway || ''),
      phase: reviewPhaseLabel(row.phase),
      position: reviewPositionDescription(row.whiteCp, row.mate),
      accuracy: Math.round((Number(row.accuracy) || 0) * 10) / 10,
      loss: Math.max(0, Number(row.rawEngineLoss) || 0),
      best: row.engineBest,
      moveLabel: reviewMoveNotation(row),
      exactOpening: exact.name
    };
  }

  if (row.autoExplanationV2) return row.autoExplanationV2;

  const moveLabel = `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san}`;
  const phase = reviewPhaseLabel(row.phase);
  const position = row.terminal?.type === 'checkmate'
    ? `${row.terminal.winner === 'w' ? 'White' : 'Black'} won by checkmate`
    : reviewPositionDescription(row.whiteCp, row.mate);
  const best = row.engineBest && row.engineBest !== ' - ' ? row.engineBest : null;
  const pv = (row.principalVariationSan || []).slice(0, 5);
  const loss = Math.max(0, Number(row.rawEngineLoss) || 0);
  const cls = String(row.label || row.cls || 'Move');
  const accuracy = Math.round((Number(row.accuracy) || 0) * 10) / 10;
  const playedFacts = reviewMoveFacts(row.previousFen, row.san);
  const playedPurpose = reviewDescribeMovePurpose(playedFacts);

  let headline = `${moveLabel} — ${cls}`;
  let why = '';
  let comparison = '';
  let comparisonLabel = '';
  let lesson = '';

  if (row.terminal?.type === 'checkmate') {
    why = `${row.san} ends the game immediately by checkmate. The move is forcing and leaves the opponent no legal way to continue.`;
    lesson = 'When you have a forced finish, calculate checks and captures before worrying about positional improvements.';
  } else if (row.isBook) {
    const authored = reviewAuthoredOpeningExplanation(row);
    const openingContext = reviewOpeningContext(row);

    if (authored) {
      // Use the opening author's actual move-by-move teaching text. This is the
      // same theory the Study/Trainer side already exposes; Review should not
      // replace it with a vague generated sentence.
      why = authored;
      lesson = reviewTransferableLesson(row, reviewStructuredMoveAnalysis(row, Math.max(0,row.ply-1)));
    } else if (playedPurpose) {
      why = `${row.san} is part of ${openingContext || 'the detected opening'}. Concretely, it ${playedPurpose}.`;
      lesson = reviewTransferableLesson(row, reviewStructuredMoveAnalysis(row, Math.max(0,row.ply-1)));
    } else {
      const exact = reviewOpeningNameForPly(row.ply);
      const openingName = [exact.name, exact.variation].filter(Boolean).join(': ') || 'this opening';
      if (state.session?.user) {
        why = `Preparing the move-specific explanation for ${row.san} in ${openingName}…`;
        lesson = `BOZO is checking the position and continuation before showing a teaching note.`;
      } else {
        why = `${row.san} is a theoretical move in ${openingName}.`;
        lesson = `Sign in to generate the full move-specific teaching explanation automatically.`;
      }
    }

    comparison = '';
  } else if (row.wasTop || loss <= 15) {
    why = playedPurpose
      ? `${row.san} is very precise because it ${playedPurpose} without giving the opponent a meaningful concession.`
      : `${row.san} is very precise and keeps the position at ${position.toLowerCase()} without giving away anything important.`;
    lesson = reviewTransferableLesson(row, reviewStructuredMoveAnalysis(row, Math.max(0,row.ply-1)));
  } else {
    const costPhrase =
      loss <= 40 ? 'only a little precision'
      : loss <= 80 ? 'a modest amount of control'
      : loss <= 150 ? 'a meaningful part of the position'
      : loss <= 250 ? 'a large part of the position'
      : 'a major part of the position';

    why = `${row.san} is playable, but it gives up ${costPhrase}.`;
    if (playedPurpose) why += ` It does ${playedPurpose}, but the position offered a more efficient way to solve the same problem.`;
    else why += ` The issue is not that the move is random; it is that the position offered a more efficient continuation.`;

    if (best && best !== row.san) {
      comparisonLabel = `More precise: ${best}`;
      comparison = reviewConcreteComparison(row, best, pv);
    }

    if (loss <= 40) {
      lesson = 'Small inaccuracies are usually about efficiency: look for a move that improves the position while giving the opponent less counterplay.';
    } else if (loss <= 80) {
      lesson = 'When two moves look reasonable, compare what each one develops, protects, attacks, and allows on the next move.';
    } else if (loss <= 150) {
      lesson = 'Before committing, check the opponent’s forcing replies and compare your move with a continuation that solves the position more directly.';
    } else if (loss <= 250) {
      lesson = 'This is worth reviewing concretely: identify what the more precise move accomplishes that the played move fails to accomplish.';
    } else {
      lesson = 'At a major swing, find the concrete tactical or positional resource that changed the game instead of memorizing the evaluation number.';
    }
  }


  if(!row.isBook && !row.wasTop && loss>=80){
    const consequence=reviewContinuationConsequences(row,{fromBefore:false,maxPlies:8});
    const myLoss=reviewMaterialLossPhrase(consequence?.mineLost||{});
    if(consequence?.deliveredMate){
      why += ` The concrete problem is that the opponent's best continuation leads to forced mate.`;
    } else if(myLoss){
      why += ` With best play, this allows the loss of ${myLoss}.`;
    }
  }

  if (!row.isBook && !comparison && best && best !== row.san) {
    comparisonLabel = `More precise: ${best}`;
    comparison = reviewConcreteComparison(row, best, pv);
  }

  const structureForAuto=row.generatedTeachingNote?.structure || reviewStructuredMoveAnalysis(row,Math.max(0,row.ply-1));
  const promotionTeaching=reviewPromotionTeaching(row,structureForAuto);
  const specialTeaching=reviewGreatBrilliantTeaching(row,structureForAuto);
  if(promotionTeaching){
    why=promotionTeaching.why;
    lesson=promotionTeaching.lesson;
    comparison='';
    comparisonLabel='';
  } else if(specialTeaching){
    why=specialTeaching.why;
    lesson=specialTeaching.lesson;
    comparison='';
    comparisonLabel='';
  }

  why=reviewCoachFacingText(why);
  comparison=reviewCoachFacingText(comparison);
  lesson=reviewCoachFacingText(lesson);

  row.autoExplanationV2 = {
    headline,
    why,
    comparison,
    comparisonLabel,
    lesson,
    phase,
    position,
    accuracy,
    loss,
    best,
    moveLabel
  };
  return row.autoExplanationV2;
}


const REVIEW_VOICE_PREF_KEY='bozo-review-voice-enabled';
const REVIEW_VOICE_ID_KEY='bozo-review-voice-id';
const REVIEW_KOKORO_MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
const REVIEW_KOKORO_ESM='https://cdn.jsdelivr.net/npm/kokoro-js/+esm';
const REVIEW_COACH_VOICES={
  daniel:{label:'Daniel',requested:'bm_daniel',fallback:'bm_daniel'},
  george:{label:'George',requested:'bm_v0george',fallback:'bm_george'}
};
reviewVoiceEnabled=localStorage.getItem(REVIEW_VOICE_PREF_KEY)==='1';
reviewVoiceId=localStorage.getItem(REVIEW_VOICE_ID_KEY)||'daniel';
if(!REVIEW_COACH_VOICES[reviewVoiceId])reviewVoiceId='daniel';
queueMicrotask(()=>updateReviewVoiceButton());
let reviewVoicePlayback=null;
let reviewVoiceObjectUrl='';
let reviewKokoroPromise=null;
let reviewVoiceRequestToken=0;
const reviewVoiceCache=new Map();

function reviewVoiceText(row){
  if(!row)return '';
  const ex=reviewAutoExplanation(row);
  return reviewChessTextForSpeech([ex.why,ex.comparison,ex.lesson].filter(Boolean).join(' '));
}
function reviewChessTextForSpeech(text){
  if(!text)return '';
  let spoken=String(text);

  // Speak castling naturally before processing individual SAN tokens.
  spoken=spoken
    .replace(/\b(?:O|0)-(?:O|0)-(?:O|0)\b/g,'castle queenside')
    .replace(/\b(?:O|0)-(?:O|0)\b/g,'castle kingside');

  // Promotions written in prose/SAN, e.g. a8=Q, b1=N+.
  const promotionPiece={Q:'queen',R:'rook',B:'bishop',N:'knight'};
  spoken=spoken.replace(/\b([a-h])([18])=([QRBN])([+#]?)/g,(m,file,rank,piece,suffix)=>{
    const ending=suffix==='#'?' checkmate':suffix==='+'?' check':'';
    return `${file}${rank} promotes to a ${promotionPiece[piece]}${ending}`;
  });

  // Full SAN piece moves: Nf6, Bxh7+, Rxe5, Qg4#, Kf2, Nbd2, R1e2, etc.
  const pieceName={K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight'};
  const sanPiece=/\b([KQRBN])([a-h1-8]{0,2})(x?)([a-h][1-8])([+#]?)(?=\s|[.,;:!?)]|$)/g;
  spoken=spoken.replace(sanPiece,(m,piece,disamb,capture,target,suffix)=>{
    let phrase=pieceName[piece];
    if(disamb){
      if(/^[a-h]$/.test(disamb))phrase+=` from the ${disamb}-file`;
      else if(/^[1-8]$/.test(disamb))phrase+=` from rank ${disamb}`;
      else if(/^[a-h][1-8]$/.test(disamb))phrase+=` from ${disamb}`;
    }
    phrase+=capture?' takes ':' to ';
    phrase+=target;
    if(suffix==='#')phrase+=' checkmate';
    else if(suffix==='+')phrase+=' check';
    return phrase;
  });

  // Pawn SAN used in explanations, e.g. exd5, e8=Q was handled above.
  spoken=spoken.replace(/\b([a-h])(x)([a-h][1-8])([+#]?)(?=\s|[.,;:!?)]|$)/g,(m,file,_x,target,suffix)=>{
    let phrase=`${file}-pawn takes ${target}`;
    if(suffix==='#')phrase+=' checkmate';
    else if(suffix==='+')phrase+=' check';
    return phrase;
  });

  // Final chess-symbol guard: never let TTS literally say "plus" or "hash" for SAN suffixes.
  // This catches notation that was left intact by an unusual surrounding punctuation/context.
  spoken=spoken
    .replace(/(?<=[a-h1-8])\+(?=\s|[.,;:!?)]|$)/g,' check')
    .replace(/(?<=[a-h1-8])#(?=\s|[.,;:!?)]|$)/g,' checkmate');

  // Standalone algebraic square names are clearer as "e four" than "e four" being inferred inconsistently.
  const rankWord={'1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight'};
  spoken=spoken.replace(/\b([a-h])([1-8])\b/g,(m,file,rank)=>`${file} ${rankWord[rank]}`);

  // Remaining chess abbreviations that can occur outside strict SAN. Keep these word-boundary-safe
  // so normal words beginning with B/K/N/Q/R are untouched.
  spoken=spoken
    .replace(/\bQ\b/g,'queen')
    .replace(/\bR\b/g,'rook')
    .replace(/\bB\b/g,'bishop')
    .replace(/\bN\b/g,'knight')
    .replace(/\bK\b/g,'king');

  return spoken.replace(/\s+/g,' ').trim();
}
function reviewVoiceStatus(text,state=''){
  const el=$('review-voice-status');if(!el)return;
  el.textContent=text||'';
  el.dataset.state=state;
}
function reviewStopVoice(){
  reviewVoiceRequestToken++;
  try{reviewVoicePlayback?.pause?.();}catch{}
  reviewVoicePlayback=null;
  if(reviewVoiceObjectUrl){try{URL.revokeObjectURL(reviewVoiceObjectUrl);}catch{}reviewVoiceObjectUrl='';}
  try{window.speechSynthesis?.cancel?.();}catch{}
}
function updateReviewVoiceButton(){
  const b=$('review-voice-toggle');if(b){
    b.classList.toggle('active',reviewVoiceEnabled);
    b.setAttribute('aria-pressed',String(reviewVoiceEnabled));
    b.textContent=reviewVoiceEnabled?'🔊 Coach voice on':'🔇 Coach voice off';
  }
  const select=$('review-voice-select');if(select)select.value=reviewVoiceId;
}
function setReviewVoiceEnabled(enabled){
  reviewVoiceEnabled=Boolean(enabled);
  localStorage.setItem(REVIEW_VOICE_PREF_KEY,reviewVoiceEnabled?'1':'0');
  if(!reviewVoiceEnabled){reviewStopVoice();reviewVoiceStatus('');}
  updateReviewVoiceButton();
}
function setReviewVoiceId(id){
  if(!REVIEW_COACH_VOICES[id])return;
  reviewStopVoice();
  reviewVoiceId=id;
  localStorage.setItem(REVIEW_VOICE_ID_KEY,id);
  updateReviewVoiceButton();
  reviewVoiceStatus(`${REVIEW_COACH_VOICES[id].label} selected.`,'ready');
}
async function loadReviewKokoro(){
  if(reviewKokoroPromise)return reviewKokoroPromise;
  reviewVoiceStatus(`Loading local ${REVIEW_COACH_VOICES[reviewVoiceId].label} voice for the first time…`,'loading');
  reviewKokoroPromise=(async()=>{
    const mod=await import(REVIEW_KOKORO_ESM);
    const {KokoroTTS}=mod;
    if(!KokoroTTS)throw new Error('KokoroTTS module unavailable');
    const tts=await KokoroTTS.from_pretrained(REVIEW_KOKORO_MODEL,{dtype:'q8',device:'wasm'});
    reviewVoiceStatus('Local coach voice ready.','ready');
    return tts;
  })().catch(error=>{
    reviewKokoroPromise=null;
    reviewVoiceStatus('Local voice could not load. Browser fallback will be used.','error');
    throw error;
  });
  return reviewKokoroPromise;
}
function reviewSpeechFallback(text){
  if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return false;
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang='en-GB';utterance.rate=.96;utterance.pitch=1;
    const voices=speechSynthesis.getVoices?.()||[];
    const british=voices.find(v=>/^en-GB/i.test(v.lang)&&/male|daniel|george|oliver|ryan/i.test(v.name))||voices.find(v=>/^en-GB/i.test(v.lang));
    if(british)utterance.voice=british;
    reviewVoicePlayback={pause:()=>speechSynthesis.cancel()};
    speechSynthesis.speak(utterance);
    reviewVoiceStatus('Using this device’s British voice fallback.','fallback');
    return true;
  }catch{return false;}
}
async function requestReviewCoachAudio(text,row){
  const tts=await loadReviewKokoro();
  const voiceConfig=REVIEW_COACH_VOICES[reviewVoiceId];
  let voice=voiceConfig.requested;
  try{
    const available=typeof tts.list_voices==='function'?await tts.list_voices():tts.voices;
    const has=id=>Array.isArray(available)
      ?available.some(v=>(typeof v==='string'?v:v?.id||v?.name)===id)
      :Boolean(available&&Object.prototype.hasOwnProperty.call(available,id));
    if(!has(voice)&&voiceConfig.fallback)voice=voiceConfig.fallback;
  }catch{voice=voiceConfig.fallback||voice;}
  const cacheKey=`${voice}|${text}`;
  if(reviewVoiceCache.has(cacheKey))return {blob:reviewVoiceCache.get(cacheKey),voice};
  reviewVoiceStatus(`Generating ${voiceConfig.label} locally…`,'loading');
  const generated=await tts.generate(text,{voice,speed:1});
  const blob=generated?.toBlob?.();
  if(!blob)throw new Error('Kokoro returned no playable audio');
  if(reviewVoiceCache.size>24){const first=reviewVoiceCache.keys().next().value;reviewVoiceCache.delete(first);}
  reviewVoiceCache.set(cacheKey,blob);
  reviewVoiceStatus(`${voiceConfig.label} ready${voice!==voiceConfig.requested?' (current George model)':''}.`,'ready');
  return {blob,voice};
}
async function speakCurrentReviewExplanation(row,{manual=false}={}){
  reviewStopVoice();
  if(!reviewVoiceEnabled||!row)return;
  const token=reviewVoiceRequestToken;
  const text=reviewVoiceText(row);if(!text)return;
  try{
    const audio=await requestReviewCoachAudio(text,row);
    if(token!==reviewVoiceRequestToken)return;
    const src=audio.url||(audio.blob?URL.createObjectURL(audio.blob):'');if(!src)return;
    reviewVoiceObjectUrl=audio.blob?src:'';
    reviewVoicePlayback=new Audio(src);
    reviewVoicePlayback.addEventListener('ended',()=>{
      if(reviewVoiceObjectUrl===src){URL.revokeObjectURL(src);reviewVoiceObjectUrl='';}
    },{once:true});
    await reviewVoicePlayback.play();
  }catch(error){
    console.warn('Kokoro Review voice failed:',error);
    if(token!==reviewVoiceRequestToken)return;
    const fallbackWorked=reviewSpeechFallback(text);
    if(manual&&!fallbackWorked)toast('Coach voice could not play on this device.');
  }
}
function renderReviewAutoExplanation(row) {
  const answer = $('review-coach-answer');
  if (!answer) return;

  if (!row) {
    answer.innerHTML = `
      <div class="review-auto-explanation review-auto-empty">
        <span class="review-auto-badge">READY WITH THE REVIEW</span>
        <p>Select any analyzed move. BOZO's explanation is already prepared, and Previous/Next will restore each move's explanation instantly.</p>
      </div>`;
    return;
  }

  const ex = reviewAutoExplanation(row);
  answer.innerHTML = `
    <div class="review-auto-explanation">
      <div class="review-auto-topline">
        <span class="review-auto-badge">AUTO EXPLANATION</span>
        <span>${escapeHtml(ex.phase)} · ${escapeHtml(String(ex.accuracy))}% accuracy</span>
      </div>
      <h4>${escapeHtml(ex.headline)}</h4>
      <p>${escapeHtml(ex.why)}</p>
      ${ex.comparison ? `
        <div class="review-auto-comparison">
          <b>${escapeHtml(ex.comparisonLabel || 'Why this works')}</b>
          <span>${escapeHtml(ex.comparison)}</span>
        </div>` : ''}
      ${ex.lesson ? `<div class="review-auto-lesson">
        <b>Lesson from this move</b>
        <span>${escapeHtml(ex.lesson)}</span>
      </div>` : ''}
      <small>${row.generatedTeachingNote?.source === 'structured-writer'
        ? 'Built from verified position facts and the game continuation.'
        : row.generatedTeachingNote?.source === 'structured-local'
          ? 'Built directly from verified position facts.'
          : row.generatedTeachingNote?.source === 'authored-opening' || (row.isBook && reviewAuthoredOpeningExplanation(row))
            ? 'Based on BOZO’s move-by-move opening theory.'
            : state.session?.user
              ? 'Checking the position and preparing the teaching note…'
              : 'Sign in to have BOZO automatically prepare richer move-specific teaching notes.'}</small>
    </div>`;
}

function updateReviewCoachIdleState(row) {
  const primary = $('review-coach-primary-question');
  const better = $('review-coach-better-question');
  const lesson = $('review-coach-lesson-question');

  if (!row) {
    renderReviewAutoExplanation(null);
    primary.textContent = 'Why did this move matter?';
    primary.dataset.reviewQuestion = 'Why did this move matter?';
    better.textContent = 'Why is the better move stronger?';
    better.dataset.reviewQuestion = 'Why is the better move stronger here?';
    lesson.textContent = 'What lesson applies elsewhere?';
    lesson.dataset.reviewQuestion = 'What reusable lesson from this position applies to other games?';
    return;
  }

  const move = `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san}`;
  const cls = String(row.cls || row.label || '').toLowerCase();
  let label = 'Explain this move deeper';
  let question = `Explain ${move} in more depth.`;

  if (row.isBook || cls.includes('book')) {
    label = 'Why is this a book move?';
    question = `Why is ${move} a book move, and what idea does it serve?`;
  } else if (cls.includes('blunder')) {
    label = 'Why was this a blunder?';
    question = `Why was ${move} a blunder?`;
  } else if (cls.includes('mistake')) {
    label = 'Why was this a mistake?';
    question = `Why was ${move} a mistake?`;
  } else if (cls.includes('inaccuracy')) {
    label = 'Why was this inaccurate?';
    question = `Why was ${move} inaccurate?`;
  } else if (row.wasTop || cls.includes('best')) {
    label = 'Why was this the best move?';
    question = `Why was ${move} the best move?`;
  } else if (cls.includes('good') || cls.includes('excellent')) {
    label = 'Why was this move good?';
    question = `Why was ${move} a good move?`;
  }

  renderReviewAutoExplanation(row);
  primary.textContent = label;
  primary.dataset.reviewQuestion = question;

  const hasBetter = !row.isBook && !row.wasTop && row.engineBest && row.engineBest !== row.san;
  better.textContent = hasBetter ? `Why is ${row.engineBest} stronger?` : 'What was the main alternative?';
  better.dataset.reviewQuestion = hasBetter
    ? `Why is ${row.engineBest} stronger than ${row.san} here?`
    : `What was the strongest practical alternative to ${move}, and why?`;
  lesson.textContent = 'What lesson applies elsewhere?';
  lesson.dataset.reviewQuestion = `What reusable lesson from the position after ${move} applies to other games?`;
}

function updateReviewSelectedMove() {
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];
  reviewStopVoice();

  if (!row) {
    $('review-selected-move').textContent = 'Starting position';
    $('review-classification').textContent = ' - ';
    $('review-classification').className = 'review-classification';
    $('review-selected-summary').textContent =
      'Choose a move to inspect its evaluation and alternatives.';
    $('review-move-eval').textContent = 'Equal';
    $('review-move-accuracy').textContent = ' - ';
    $('review-move-loss').textContent = ' - ';
    $('review-engine-best').textContent = ' - ';
    $('review-recommended-line').hidden = true;
    $('review-recommended-line').textContent = '';
    $('review-coach-move-label').textContent = 'Choose a move';
    updateReviewCoachIdleState(null);
    drawReviewAutomaticAnnotations(null);
    return;
  }

  const moveLabel = `${Math.ceil(row.ply / 2)}${row.mover === 'w' ? '.' : '...'} ${row.san}`;
  $('review-selected-move').textContent = moveLabel;
  $('review-classification').textContent = row.label;
  $('review-classification').className = `review-classification review-${row.cls}`;
  $('review-selected-summary').textContent = reviewSelectedVerdict(row);
  const recommendedLine = reviewRecommendedLine(row);
  $('review-recommended-line').hidden = !recommendedLine;
  $('review-recommended-line').textContent = recommendedLine;
  $('review-move-eval').textContent = row.terminal?.type === 'checkmate'
    ? `${row.terminal.winner === 'w' ? 'White' : 'Black'} won by checkmate`
    : reviewPositionDescription(row.whiteCp, row.mate);
  $('review-move-accuracy').textContent = `${Math.round(row.accuracy * 10) / 10}%`;
  $('review-move-loss').textContent = row.terminal?.type === 'checkmate' ? 'none' : (row.isBook ? 'Book' : reviewEvaluationCostLabel(row.rawEngineLoss));
  $('review-engine-best').textContent = row.isBook
    ? 'Opening choice'
    : (row.wasTop ? row.san : (row.engineBest || ' - '));
  $('review-coach-move-label').textContent = moveLabel;
  updateReviewCoachIdleState(row);
  drawReviewAutomaticAnnotations(row);
  if(reviewVoiceEnabled) speakCurrentReviewExplanation(row);
}

function clearReviewCoachAnnotations() {
  $('game-review-arrow-layer').innerHTML = '';
  reviewCoachExplanation = null;
}

function clearReviewCoach() {
  clearReviewCoachAnnotations();
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];
  renderReviewAutoExplanation(row);
  drawReviewAutomaticAnnotations(row);
  $('review-coach-question').value = '';
}

async function askReviewCoach() {
  const row = reviewStepIndex === 0 ? null : reviewData?.rows[reviewStepIndex - 1];
  const answer = $('review-coach-answer');
  const button = $('ask-review-coach');

  if (!state.session?.user) {
    answer.textContent = 'Sign in before using BOZO Coach.';
    return;
  }
  if (!row) {
    answer.textContent = 'Select an analyzed move first.';
    return;
  }

  button.disabled = true;
  button.textContent = 'BOZO Coach is thinking…';
  answer.innerHTML = '<div class="coach-thinking">Turning the engine result into a useful explanation…</div>';
  clearReviewCoachAnnotations();

  try {
    const question = $('review-coach-question').value.trim();
    const exactOpeningContext = reviewOpeningNameForPly(row.ply);
    const opening = exactOpeningContext.opening || reviewData.openingMatch?.opening;
    const selectedIndex = reviewStepIndex - 1;
    const contextBeforeMoves = reviewData.rows
      .slice(Math.max(0, selectedIndex - 10), selectedIndex)
      .map(item => item.san);
    const actualContinuation = reviewData.rows
      .slice(selectedIndex + 1, selectedIndex + 9)
      .map(item => item.san);
    const contextWindow = reviewMoveWindow(
      reviewData.rows,
      selectedIndex,
      6,
      6
    );
    const gamePhase = row.phase || reviewGamePhase(
      row.ply,
      reviewData.rows.length,
      row.fen,
      reviewData.phasePlan
    );
    const reviewCoachFacts = verifiedCoachFacts(row.fen, row.previousFen, row.san);

    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        mode: 'game_review',
        gameStatus: 'completed',
        fen: row.fen,
        previousFen: row.previousFen,
        playedMove: row.san,
        moveNumber: Math.ceil(row.ply / 2),
        opening: opening?.name || 'Unknown opening',
        variation: opening?.variation || 'Imported game',
        gamePhase,
        phaseSummary: reviewPhaseSummary(gamePhase, reviewData.rows.filter(item => item.phase === gamePhase)),
        gameStory: reviewData.story || '',
        importantEvents: (reviewData.events || []).map(event => ({
          ply:event.ply,
          moveNumber:Math.ceil(event.ply / 2),
          phase:reviewGamePhase(event.ply, reviewData.rows.length, reviewData.rows[event.ply - 1]?.fen || '', reviewData.phasePlan),
          type:event.type,
          title:event.title,
          detail:event.detail
        })),
        selectedMoveImportance: row.rawEngineLoss >= 180 ? 'turning_point' : row.rawEngineLoss >= 100 ? 'critical' : row.isBook ? 'book' : row.wasTop ? 'normal' : 'normal',
        selectedSide: reviewData.playerSide === 'black' ? 'Black' : 'White',
        selectedMoveNumber: Math.ceil(row.ply / 2),
        contextWindow,
        contextBeforeMoves,
        contextBeforeText: reviewHistoryToMoveText(contextBeforeMoves),
        actualContinuation,
        planContinuityPrompt: reviewPlanContinuityPrompt(
          row,
          contextBeforeMoves,
          actualContinuation
        ),
        question: question ||
          `Compare ${row.san} with ${row.engineBest}. Explain how the preceding moves led to this decision, what changed afterward, and give me a practical plan.`,
        moveHistory: reviewData.rows.slice(0, row.ply).map(item => item.san),
        evaluationBefore: reviewStepIndex > 1
          ? reviewData.rows[reviewStepIndex - 2].whiteCp
          : 0,
        evaluationAfter: row.whiteCp,
        mateBefore: reviewStepIndex > 1 ? reviewData.rows[reviewStepIndex - 2].mate : null,
        mateAfter: row.mate,
        evaluationUnit: 'centipawns from White perspective',
        bestMove: row.engineBest,
        bestMoveFen: row.bestMoveFen,
        principalVariation: row.principalVariation,
        principalVariationSan: row.principalVariationSan,
        playedPositionDescription: reviewPositionDescription(row.whiteCp, row.mate),
        classification: row.label,
        centipawnLoss: row.rawEngineLoss,
        moveAccuracy: Math.round(row.accuracy * 10) / 10,
        openingAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === 'opening')
        ),
        middlegameAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === 'middlegame')
        ),
        endgameAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === 'endgame')
        ),
        phaseAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === gamePhase)
        ),
        whitePhaseAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === gamePhase && item.mover === 'w')
        ),
        blackPhaseAccuracy: reviewPhaseAccuracyFor(
          reviewData.rows.filter(item => item.phase === gamePhase && item.mover === 'b')
        ),
        whitePhaseErrors: reviewErrorCounts(
          reviewData.rows.filter(item => item.phase === gamePhase && item.mover === 'w')
        ),
        blackPhaseErrors: reviewErrorCounts(
          reviewData.rows.filter(item => item.phase === gamePhase && item.mover === 'b')
        ),
        overallAccuracy: reviewAccuracyFor(reviewData.rows),
        whiteOverallAccuracy: reviewPhaseAccuracyFor(reviewData.rows.filter(item => item.mover === 'w')),
        blackOverallAccuracy: reviewPhaseAccuracyFor(reviewData.rows.filter(item => item.mover === 'b')),
        verifiedBoardFacts: reviewCoachFacts,
        strictGrounding: true
      }
    });

    if (error) {
      let message = error.message || 'BOZO Coach could not respond.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    if (!data?.explanation) throw new Error('BOZO Coach returned no explanation.');

    const groundedExplanation = sanitizeCoachExplanation(data.explanation, reviewCoachFacts);
    reviewCoachExplanation = groundedExplanation;
    renderReviewCoachExplanation(groundedExplanation);
  } catch (error) {
    answer.innerHTML = `<div class="coach-error">${escapeHtml(
      error?.message || 'BOZO Coach could not respond.'
    )}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Ask BOZO';
  }
}

$$('[data-review-question]').forEach(button => {
  button.addEventListener('click', () => {
    $('review-coach-question').value = button.dataset.reviewQuestion || '';
    askReviewCoach();
  });
});

function renderReviewCoachExplanation(explanation) {
  const purposes = Array.isArray(explanation.purpose)
    ? explanation.purpose.filter(Boolean)
    : [];
  const practicalPlan = Array.isArray(explanation.practicalPlan)
    ? explanation.practicalPlan.filter(Boolean)
    : [];

  $('review-coach-answer').innerHTML = `
    <p class="coach-summary">${escapeHtml(explanation.summary || '')}</p>

    ${explanation.howWeGotHere ? `
      <div class="coach-narrative coach-before-story">
        <b>How we got here</b>
        <p>${escapeHtml(explanation.howWeGotHere)}</p>
      </div>
    ` : ''}

    ${explanation.whatChanged ? `
      <div class="coach-narrative coach-after-story">
        <b>What changed after this move</b>
        <p>${escapeHtml(explanation.whatChanged)}</p>
      </div>
    ` : ''}

    ${explanation.planContinuity ? `
      <div class="coach-plan-continuity">
        <span>Plan check</span>
        <p>${escapeHtml(explanation.planContinuity)}</p>
      </div>
    ` : ''}

    ${explanation.comparison ? `
      <div class="coach-comparison">
        <b>Move comparison</b>
        <p>${escapeHtml(explanation.comparison)}</p>
      </div>
    ` : ''}

    <div class="coach-two-moves">
      ${explanation.playedMoveIdea ? `
        <div>
          <span>Your move</span>
          <p>${escapeHtml(explanation.playedMoveIdea)}</p>
        </div>
      ` : ''}
      ${explanation.betterMoveIdea ? `
        <div>
          <span>Better move</span>
          <p>${escapeHtml(explanation.betterMoveIdea)}</p>
        </div>
      ` : ''}
    </div>

    ${practicalPlan.length ? `
      <div class="coach-section coach-practical-plan">
        <b>Practical plan</b>
        <ol>${practicalPlan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
      </div>
    ` : ''}

    ${purposes.length ? `
      <div class="coach-section">
        <b>Key ideas</b>
        <ul>${purposes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${explanation.watchFor ? `
      <div class="coach-warning">
        <b>Watch for:</b>
        <span>${escapeHtml(explanation.watchFor)}</span>
      </div>
    ` : ''}

    ${explanation.suggestedQuestion ? `
      <button class="coach-follow-up"
              data-review-follow-up="${escapeHtml(explanation.suggestedQuestion)}">
        ${escapeHtml(explanation.suggestedQuestion)}
      </button>
    ` : ''}
    <div class="coach-grounding-note">Piece locations and tactical claims are checked against the current board. Unsupported or stale claims are omitted.</div>
  `;

  const followUp = $('review-coach-answer').querySelector('[data-review-follow-up]');
  if (followUp) {
    followUp.addEventListener('click', () => {
      $('review-coach-question').value = followUp.dataset.reviewFollowUp;
      askReviewCoach();
    });
  }

  drawReviewCoachAnnotations(
    explanation.arrows || [],
    explanation.highlights || []
  );
}

function reviewSquareCenter(square) {
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  return {
    x: (reviewOrientation === 'white' ? fileIndex : 7 - fileIndex) * 100 + 50,
    y: (reviewOrientation === 'white' ? 7 - rankIndex : rankIndex) * 100 + 50
  };
}


function reviewArrowMarkup(fromSq,toSq,color='#78c850',opacity=.84) {
  if(!validSquare(fromSq)||!validSquare(toSq)) return '';
  const from=annotationSquareGeometry('game-review-board',fromSq,reviewOrientation);
  const to=annotationSquareGeometry('game-review-board',toSq,reviewOrientation);
  const fileDelta=Math.abs(toSq.charCodeAt(0)-fromSq.charCodeAt(0));
  const rankDelta=Math.abs(Number(toSq[1])-Number(fromSq[1]));
  const isKnightRoute=(fileDelta===1&&rankDelta===2)||(fileDelta===2&&rankDelta===1);

  const geometry=(segmentStart,tip)=>{
    const dx=tip.x-segmentStart.x,dy=tip.y-segmentStart.y;
    const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,px=-uy,py=ux;
    const headLength=46,headHalfWidth=29;
    const base={x:tip.x-ux*headLength,y:tip.y-uy*headLength};
    const left={x:base.x+px*headHalfWidth,y:base.y+py*headHalfWidth};
    const right={x:base.x-px*headHalfWidth,y:base.y-py*headHalfWidth};
    return {shaftEnd:base,points:`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`};
  };

  if(isKnightRoute){
    const elbow=fileDelta===2?{x:to.x,y:from.y}:{x:from.x,y:to.y};
    const g=geometry(elbow,to);
    return `<path d="M ${from.x} ${from.y} L ${elbow.x} ${elbow.y} L ${g.shaftEnd.x} ${g.shaftEnd.y}"
      fill="none" stroke="${color}" stroke-width="18" stroke-linecap="square" stroke-linejoin="miter" opacity="${opacity}"></path>
      <polygon points="${g.points}" fill="${color}" opacity=".92"></polygon>`;
  }

  const g=geometry(from,to);
  return `<line x1="${from.x}" y1="${from.y}" x2="${g.shaftEnd.x}" y2="${g.shaftEnd.y}"
      stroke="${color}" stroke-width="18" stroke-linecap="square" opacity="${opacity}"></line>
      <polygon points="${g.points}" fill="${color}" opacity=".92"></polygon>`;
}

function reviewHighlightMarkup(square,color='#a855f7') {
  if(!validSquare(square)) return '';
  const c=annotationSquareGeometry('game-review-board',square,reviewOrientation);
  const w=c.width*.96,h=c.height*.96;
  return `<rect x="${c.x-w/2}" y="${c.y-h/2}" width="${w}" height="${h}" rx="7" fill="${color}" opacity=".24"></rect>`;
}

function reviewAutomaticAnnotations(row) {
  if(!row) return {arrows:[],highlights:[]};
  const arrows=[],highlights=[];

  // Always show the move being explained.
  if(validSquare(row.from)&&validSquare(row.to))
    arrows.push({from:row.from,to:row.to,color:'#78c850'});

  const structure=row.generatedTeachingNote?.structure || reviewStructuredMoveAnalysis(row,Math.max(0,row.ply-1));
  const promotion=reviewPromotionTeaching(row,structure);
  if(promotion?.info){
    // One continuous plan arrow, not a chain of tiny arrows.
    arrows.push({from:promotion.info.square,to:promotion.info.promotionSquare,color:'#42a5f5'});
    highlights.push({square:promotion.info.promotionSquare,color:'#42a5f5'});
  }

  return {arrows:arrows.slice(0,3),highlights:highlights.slice(0,3)};
}

function drawReviewAutomaticAnnotations(row) {
  const svg=$('game-review-arrow-layer');
  if(!svg) return;
  const auto=reviewAutomaticAnnotations(row);
  svg.innerHTML=[
    ...auto.highlights.map(x=>reviewHighlightMarkup(x.square,x.color)),
    ...auto.arrows.map(x=>reviewArrowMarkup(x.from,x.to,x.color))
  ].join('');
  reviewCoachExplanation=null;
}

function drawReviewCoachAnnotations(arrows = [], highlights = []) {
  const svg=$('game-review-arrow-layer');
  if(!svg) return;
  const colors={green:'#78c850',yellow:'#f6c945',red:'#ef5350',blue:'#42a5f5',purple:'#a855f7'};
  svg.innerHTML=[
    ...highlights.filter(x=>validSquare(x.square)).slice(0,4)
      .map(x=>reviewHighlightMarkup(x.square,colors[x.color]||colors.purple)),
    ...arrows.filter(x=>validSquare(x.from)&&validSquare(x.to)).slice(0,4)
      .map(x=>reviewArrowMarkup(x.from,x.to,colors[x.color]||colors.purple))
  ].join('');
}




/* ============================================================
   BOZO v4.1: RATINGS + MATCHMAKING
   ============================================================ */

let bozoRatings = [];
let pendingMatchmakingAfterRating = null;
let playRatingPromptShown = false;

let matchmakingTicket = null;
let matchmakingPollTimer = null;
let matchmakingBusy = false;

function ratingRow(pool) {
  return bozoRatings.find(row => row.pool === pool) || null;
}

function formatPoolName(pool='') {
  return String(pool).charAt(0).toUpperCase() + String(pool).slice(1);
}

function placementText(row) {
  if (!row) return 'Not initialized';
  if (row.is_established) return `${row.wins || 0}W ${row.losses || 0}L ${row.draws || 0}D`;
  return `Placement ${row.placement_games || 0}/10`;
}

async function loadBozoRatings() {
  if (!state.session?.user) {
    bozoRatings = [];
    paintPlayRatings();
    return [];
  }
  try {
    const { data, error } = await sb.rpc('get_my_ratings');
    if (error) throw error;
    bozoRatings = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Could not load ratings:', error);
    bozoRatings = [];
  }
  paintPlayRatings();
  updateMatchmakingRatingSummary();
  return bozoRatings;
}

function paintPlayRatings() {
  const grid = $('play-rating-grid');
  if (!grid) return;

  const pools = ['bullet','blitz','rapid','classical'];
  grid.innerHTML = pools.map(pool => {
    const row = ratingRow(pool);
    const display = row?.display_rating || ' - ';
    return `<button class="play-rating-chip" data-rating-pool="${pool}">
      <span>${formatPoolName(pool)}</span>
      <b>${escapeHtml(display)}</b>
      <small>${escapeHtml(placementText(row))}</small>
    </button>`;
  }).join('');

  const rapid = ratingRow('rapid');
  const primary = $('play-primary-rating');
  if (primary) primary.textContent = rapid
    ? `Rapid ${rapid.display_rating} · ${placementText(rapid)}`
    : 'Rapid: · Set up rated play';
}

function openRatingSetup(pool='rapid') {
  const modal = $('rating-setup-modal');
  if (!modal) return;
  $('rating-setup-pool').value = pool;
  $('rating-setup-message').textContent = '';
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    modal.querySelector('[data-rating-tier]')?.focus?.();
  });
}

function closeRatingSetup({ preservePending = false } = {}) {
  const modal = $('rating-setup-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (!preservePending) pendingMatchmakingAfterRating = null;
}

async function initializeBozoRating(tier) {
  const pool = $('rating-setup-pool')?.value || 'rapid';
  const message = $('rating-setup-message');
  if (message) message.textContent = 'Setting up your provisional rating…';

  try {
    const { data, error } = await sb.rpc('initialize_my_rating', {
      selected_pool: pool,
      selected_starting_tier: tier
    });
    if (error) throw error;
    await loadBozoRatings();
    if (message) message.textContent = 'Rating ready.';

    const pending = pendingMatchmakingAfterRating;
    pendingMatchmakingAfterRating = null;

    setTimeout(async () => {
      closeRatingSetup();

      if (pending && pending.pool === pool) {
        const poolSelect = $('matchmaking-pool');
        const timeSelect = $('matchmaking-time');
        if (poolSelect) poolSelect.value = pending.pool;
        if (timeSelect && pending.timeControl) timeSelect.value = pending.timeControl;
        updateMatchmakingRatingSummary();

        const status = $('matchmaking-status');
        if (status) status.textContent = 'Rating ready. Entering matchmaking…';
        await enterMatchmakingQueue();
      }
    }, 350);
  } catch (error) {
    if (message) message.textContent = error?.message || 'Could not initialize this rating.';
  }
}

function selectedMatchmakingPool() {
  return $('matchmaking-pool')?.value || 'rapid';
}

function selectedMatchmakingTime() {
  const raw = $('matchmaking-time')?.value || '600+0';
  const [base, inc] = raw.split('+').map(Number);
  return { base_seconds: base || 600, increment_seconds: inc || 0 };
}

const MATCHMAKING_TIME_CONTROLS = {
  bullet: ['60+0', '60+1', '120+1'],
  blitz: ['180+0', '180+2', '300+0', '300+3'],
  rapid: ['600+0', '600+5', '900+10'],
  classical: ['1800+0', '1800+20'],
};

const MATCHMAKING_POOL_DEFAULTS = {
  bullet: '60+0',
  blitz: '180+2',
  rapid: '600+0',
  classical: '1800+0',
};

function poolForMatchmakingTime(value) {
  return Object.keys(MATCHMAKING_TIME_CONTROLS).find(pool =>
    MATCHMAKING_TIME_CONTROLS[pool].includes(value)
  ) || 'rapid';
}

function syncPoolToMatchmakingTime() {
  const timeSelect = $('matchmaking-time');
  const poolSelect = $('matchmaking-pool');
  if (!timeSelect || !poolSelect) return;
  poolSelect.value = poolForMatchmakingTime(timeSelect.value);
  updateMatchmakingRatingSummary();
}

function syncTimeToMatchmakingPool() {
  const timeSelect = $('matchmaking-time');
  const poolSelect = $('matchmaking-pool');
  if (!timeSelect || !poolSelect) return;
  const pool = poolSelect.value || 'rapid';
  if (!MATCHMAKING_TIME_CONTROLS[pool]?.includes(timeSelect.value)) {
    timeSelect.value = MATCHMAKING_POOL_DEFAULTS[pool] || '600+0';
  }
  updateMatchmakingRatingSummary();
}

function updateMatchmakingRatingSummary() {
  const el = $('matchmaking-rating-summary');
  if (!el) return;
  const pool = selectedMatchmakingPool();
  const row = ratingRow(pool);
  if (!row) {
    el.innerHTML = `<b>${formatPoolName(pool)}:</b> not initialized · choose a starting estimate first`;
    return;
  }
  el.innerHTML = `<b>${formatPoolName(pool)} ${escapeHtml(row.display_rating)}</b> · ${escapeHtml(placementText(row))}`;
}

async function ensureRatingForMatchmaking() {
  const pool = selectedMatchmakingPool();
  const row = ratingRow(pool);
  if (!row) {
    pendingMatchmakingAfterRating = {
      pool,
      timeControl: $('matchmaking-time')?.value || MATCHMAKING_POOL_DEFAULTS[pool] || '600+0'
    };
    const message = $('matchmaking-status');
    if (message) message.textContent = `Set your ${formatPoolName(pool)} starting estimate, then BOZO will enter the queue automatically.`;
    openRatingSetup(pool);
    return null;
  }
  return row;
}

async function enterMatchmakingQueue() {
  if (matchmakingBusy || matchmakingTicket) return;
  if (!state.session?.user) {
    $('matchmaking-status').textContent = 'Sign in before entering matchmaking.';
    return;
  }
  const row = await ensureRatingForMatchmaking();
  if (!row) return;

  const pool = selectedMatchmakingPool();
  const timing = selectedMatchmakingTime();
  matchmakingBusy = true;
  $('find-opponent-button').disabled = true;
  $('matchmaking-status').textContent = 'Looking for an opponent…';

  try {
    const { data, error } = await sb.rpc('join_matchmaking_queue', {
      selected_pool: pool,
      selected_base_seconds: timing.base_seconds,
      selected_increment_seconds: timing.increment_seconds
    });
    if (error) throw error;

    const ticket = Array.isArray(data) ? data[0] : data;
    matchmakingTicket = ticket || null;
    $('find-opponent-button').hidden = true;
    $('cancel-matchmaking-button').hidden = false;

    if (ticket?.match_id) {
      await handleMatchFound(ticket.match_id);
      return;
    }

    $('matchmaking-status').textContent = `Searching ${formatPoolName(pool)} ${Math.round(timing.base_seconds/60)}+${timing.increment_seconds}…`;
    startMatchmakingPolling();
  } catch (error) {
    matchmakingTicket = null;
    $('matchmaking-status').textContent = error?.message || 'Could not enter matchmaking.';
    $('find-opponent-button').hidden = false;
    $('cancel-matchmaking-button').hidden = true;
  } finally {
    matchmakingBusy = false;
    $('find-opponent-button').disabled = false;
  }
}

function stopMatchmakingPolling() {
  if (matchmakingPollTimer) clearInterval(matchmakingPollTimer);
  matchmakingPollTimer = null;
}

function startMatchmakingPolling() {
  stopMatchmakingPolling();
  pollMatchmakingStatus();
  matchmakingPollTimer = setInterval(pollMatchmakingStatus, 2200);
}

async function pollMatchmakingStatus() {
  if (!matchmakingTicket?.ticket_id) return;
  try {
    const { data, error } = await sb.rpc('get_matchmaking_status', {
      target_ticket_id: matchmakingTicket.ticket_id
    });
    if (error) throw error;
    const status = Array.isArray(data) ? data[0] : data;
    if (!status) return;

    if (status.match_id) {
      stopMatchmakingPolling();
      await handleMatchFound(status.match_id);
      return;
    }
    $('matchmaking-status').textContent =
      status.status === 'searching' ? 'Searching for a similarly rated opponent…' : (status.status || 'Searching…');
  } catch (error) {
    console.warn('Matchmaking poll failed:', error);
  }
}

async function leaveMatchmakingQueue() {
  if (!matchmakingTicket?.ticket_id) {
    resetMatchmakingUi();
    return;
  }
  try {
    await sb.rpc('leave_matchmaking_queue', {
      target_ticket_id: matchmakingTicket.ticket_id
    });
  } catch (error) {
    console.warn('Could not leave matchmaking queue:', error);
  }
  resetMatchmakingUi();
}

function resetMatchmakingUi() {
  stopMatchmakingPolling();
  matchmakingTicket = null;
  $('find-opponent-button').hidden = false;
  $('cancel-matchmaking-button').hidden = true;
  $('matchmaking-status').textContent = '';
}

async function handleMatchFound(matchId) {
  stopMatchmakingPolling();
  $('matchmaking-status').textContent = 'Opponent found! Opening game…';
  matchmakingTicket = null;

  // v4.1 opens a real server-backed match record. The actual live board uses
  // a dedicated multiplayer surface added by openRatedMatch().
  await openRatedMatch(matchId);
}

let ratedClockRenderTimer = null;
let ratedTimeoutClaimPending = false;

let ratedPremove = null;
let ratedPremoveExecuting = false;
let ratedNegotiationPending = false;

function clearRatedPremove() {
  ratedPremove = null;
  ratedPremoveExecuting = false;
}

function paintRatedPremove() {
  const board = $('web-bot-board');
  if (!board) return;
  board.querySelectorAll('.rated-premove-from,.rated-premove-to').forEach(el => {
    el.classList.remove('rated-premove-from','rated-premove-to');
  });
  if (!ratedPremove || !ratedMatchSession) return;
  board.querySelector(`[data-rated-square="${ratedPremove.from}"]`)?.classList.add('rated-premove-from');
  board.querySelector(`[data-rated-square="${ratedPremove.to}"]`)?.classList.add('rated-premove-to');
}

function queueRatedPremove(from, to, promotion='q') {
  // Single-slot by design. Queueing another premove REPLACES the previous one.
  ratedPremove = { from, to, promotion };
  ratedMatchSelectedSquare = null;
  paintRatedOnlineGame();
  $('bot-game-message').textContent = `Premove queued: ${from}-${to}.`;
}

async function tryExecuteRatedPremove() {
  if (!ratedPremove || !ratedMatchSession || ratedPremoveExecuting) return;
  if (ratedMatchSession.status !== 'active' || ratedMatchSession.movePending) return;
  if (!ratedOnlineIsMyTurn()) return;

  // Consume first so the same premove can never fire twice.
  const queued = ratedPremove;
  ratedPremove = null;
  ratedPremoveExecuting = true;

  try {
    const legal = ratedMatchSession.game
      .moves({ square: queued.from, verbose: true })
      .find(move =>
        move.to === queued.to &&
        (!move.promotion || move.promotion === queued.promotion)
      );

    if (!legal) {
      paintRatedOnlineGame();
      $('bot-game-message').textContent =
        'Premove cancelled because the opponent made it illegal.';
      return;
    }

    await executeRatedOnlineCandidate(legal, true);
  } finally {
    ratedPremoveExecuting = false;
  }
}

function updateRatedNegotiationUI() {
  if (!ratedMatchSession) return;
  const uid = state.session?.user?.id;
  const active = ratedMatchSession.status === 'active';

  const offer = $('rated-offer-draw-button');
  const drawPanel = $('rated-draw-offer-panel');
  const rematch = $('rated-rematch-button');
  const rematchPanel = $('rated-rematch-panel');

  if (offer) {
    offer.hidden = !active;
    offer.disabled = ratedNegotiationPending || Boolean(ratedMatchSession.draw_offer_by);
    offer.textContent = ratedMatchSession.draw_offer_by === uid ? 'Draw offered' : 'Offer draw';
  }

  if (drawPanel) {
    const mine = ratedMatchSession.draw_offer_by === uid;
    const incoming = active && Boolean(ratedMatchSession.draw_offer_by) && !mine;
    const outgoing = active && mine;
    drawPanel.hidden = !(incoming || outgoing);

    if (incoming) {
      $('rated-draw-offer-title').textContent = 'Your opponent offers a draw';
      $('rated-draw-offer-message').textContent = 'Accept the draw or decline and continue.';
      $('rated-draw-response-actions').hidden = false;
    } else if (outgoing) {
      $('rated-draw-offer-title').textContent = 'Draw offer sent';
      $('rated-draw-offer-message').textContent = 'Waiting for your opponent.';
      $('rated-draw-response-actions').hidden = true;
    }
  }

  if (rematch) {
    rematch.hidden = active;
    rematch.disabled = ratedNegotiationPending || Boolean(ratedMatchSession.rematch_offer_by);
    rematch.textContent = ratedMatchSession.rematch_offer_by === uid ? 'Rematch requested' : 'Rematch';
  }

  if (rematchPanel) {
    const mine = ratedMatchSession.rematch_offer_by === uid;
    const incoming = !active && Boolean(ratedMatchSession.rematch_offer_by) && !mine;
    const outgoing = !active && mine;
    rematchPanel.hidden = !(incoming || outgoing);

    if (incoming) {
      $('rated-rematch-title').textContent = 'Your opponent wants a rematch';
      $('rated-rematch-message').textContent = 'Accept to play again with colors swapped.';
      $('rated-rematch-response-actions').hidden = false;
    } else if (outgoing) {
      $('rated-rematch-title').textContent = 'Rematch requested';
      $('rated-rematch-message').textContent = 'Waiting for your opponent.';
      $('rated-rematch-response-actions').hidden = true;
    }
  }
}

async function ratedMatchAction(action) {
  if (!ratedMatchSession?.id || ratedNegotiationPending) return null;
  ratedNegotiationPending = true;
  updateRatedNegotiationUI();
  try {
    const { data, error } = await sb.functions.invoke('rated-match', {
      body: { action, matchId: ratedMatchSession.id }
    });
    if (error) {
      let message = error.message || 'Request failed.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    toast(error?.message || 'That request could not be completed.');
    return null;
  } finally {
    ratedNegotiationPending = false;
    updateRatedNegotiationUI();
  }
}

async function offerRatedDraw() {
  const data = await ratedMatchAction('offer-draw');
  if (!data) return;
  ratedMatchSession.draw_offer_by = state.session.user.id;
  ratedMatchSession.draw_offer_at = new Date().toISOString();
  updateRatedNegotiationUI();
}

async function respondRatedDraw(accept) {
  const data = await ratedMatchAction(accept ? 'accept-draw' : 'decline-draw');
  if (!data) return;
  if (accept) await refreshRatedMatchFromServer();
  else {
    ratedMatchSession.draw_offer_by = null;
    ratedMatchSession.draw_offer_at = null;
    updateRatedNegotiationUI();
  }
}

async function requestRatedRematch() {
  const data = await ratedMatchAction('offer-rematch');
  if (!data) return;
  ratedMatchSession.rematch_offer_by = state.session.user.id;
  ratedMatchSession.rematch_offer_at = new Date().toISOString();
  updateRatedNegotiationUI();
}

async function respondRatedRematch(accept) {
  const data = await ratedMatchAction(accept ? 'accept-rematch' : 'decline-rematch');
  if (!data) return;
  if (accept && data.new_match_id) {
    await openRatedMatch(data.new_match_id);
  } else {
    ratedMatchSession.rematch_offer_by = null;
    ratedMatchSession.rematch_offer_at = null;
    updateRatedNegotiationUI();
  }
}


function ratedClockBaseMs(session=ratedMatchSession) {
  return Math.max(0, Number(session?.base_seconds || 0) * 1000);
}

function ratedClockStoredMs(color, session=ratedMatchSession) {
  if (!session) return 0;
  const field = color === 'w' ? 'white_time_ms' : 'black_time_ms';
  const raw = Number(session[field]);
  return Number.isFinite(raw) ? Math.max(0, raw) : ratedClockBaseMs(session);
}

function ratedClockProjectedMs(color, session=ratedMatchSession, nowMs=Date.now()) {
  if (!session) return 0;
  let remaining = ratedClockStoredMs(color, session);
  if (
    session.status === 'active' &&
    session.clock_running_color === color &&
    session.clock_started_at
  ) {
    const started = Date.parse(session.clock_started_at);
    if (Number.isFinite(started)) {
      remaining -= Math.max(0, nowMs - started);
    }
  }
  return Math.max(0, remaining);
}

function formatRatedClock(ms) {
  const safe = Math.max(0, Math.ceil(Number(ms) || 0));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);

  if (safe < 10000) {
    return `${minutes}:${String(seconds).padStart(2,'0')}.${tenths}`;
  }
  return `${minutes}:${String(seconds).padStart(2,'0')}`;
}

function hideRatedClocks() {
  const mine = $('rated-my-clock');
  const theirs = $('rated-opponent-clock');
  if (mine) mine.hidden = true;
  if (theirs) theirs.hidden = true;
  stopRatedClockRenderer();
}

function paintRatedClocks() {
  if (!ratedMatchSession) return;
  const mine = $('rated-my-clock');
  const theirs = $('rated-opponent-clock');
  if (!mine || !theirs) return;

  mine.hidden = false;
  theirs.hidden = false;

  const myColor = ratedMatchSession.myColor;
  const oppColor = myColor === 'w' ? 'b' : 'w';
  const now = Date.now();
  const myMs = ratedClockProjectedMs(myColor, ratedMatchSession, now);
  const oppMs = ratedClockProjectedMs(oppColor, ratedMatchSession, now);

  mine.textContent = formatRatedClock(myMs);
  theirs.textContent = formatRatedClock(oppMs);

  const mineRunning =
    ratedMatchSession.status === 'active' &&
    ratedMatchSession.clock_running_color === myColor &&
    Boolean(ratedMatchSession.clock_started_at);
  const theirsRunning =
    ratedMatchSession.status === 'active' &&
    ratedMatchSession.clock_running_color === oppColor &&
    Boolean(ratedMatchSession.clock_started_at);

  mine.classList.toggle('running', mineRunning);
  theirs.classList.toggle('running', theirsRunning);
  mine.classList.toggle('low', myMs > 0 && myMs <= 10000);
  theirs.classList.toggle('low', oppMs > 0 && oppMs <= 10000);
  mine.classList.toggle('flagged', myMs <= 0);
  theirs.classList.toggle('flagged', oppMs <= 0);

  if (
    ratedMatchSession.status === 'active' &&
    ratedMatchSession.clock_started_at &&
    !ratedTimeoutClaimPending &&
    (
      (ratedMatchSession.clock_running_color === myColor && myMs <= 0) ||
      (ratedMatchSession.clock_running_color === oppColor && oppMs <= 0)
    )
  ) {
    claimRatedTimeout();
  }
}

function startRatedClockRenderer() {
  stopRatedClockRenderer();
  paintRatedClocks();
  ratedClockRenderTimer = setInterval(paintRatedClocks, 100);
}

function stopRatedClockRenderer() {
  if (ratedClockRenderTimer) clearInterval(ratedClockRenderTimer);
  ratedClockRenderTimer = null;
}

async function claimRatedTimeout() {
  if (!ratedMatchSession?.id || ratedTimeoutClaimPending || ratedMatchSession.status !== 'active') return;
  ratedTimeoutClaimPending = true;
  try {
    const { data, error } = await sb.functions.invoke('rated-match', {
      body: { action: 'claim-timeout', matchId: ratedMatchSession.id }
    });
    if (error) throw error;
    if (data?.error && data?.status !== 'active') throw new Error(data.error);
    await refreshRatedMatchFromServer();
  } catch (error) {
    console.warn('Timeout claim failed:', error);
  } finally {
    ratedTimeoutClaimPending = false;
  }
}


let ratedSpectatorSession = null;
let ratedSpectatorChannel = null;
let ratedSpectatorPollTimer = null;

function setRatedConnectionState(stateName='connected') {
  const row = $('rated-connection-status');
  const text = $('rated-connection-text');
  if (!row || !text) return;
  row.hidden = !(ratedMatchSession || ratedSpectatorSession);
  row.classList.toggle('reconnecting', stateName === 'reconnecting');
  row.classList.toggle('offline', stateName === 'offline');
  text.textContent = stateName === 'connected' ? 'Connected' :
    stateName === 'reconnecting' ? 'Reconnecting…' : 'Connection lost';
}

function ratedLastMove(session) {
  const moves = session?.moves || [];
  if (!moves.length) return null;
  const uci = String(moves[moves.length - 1]);
  return { from: uci.slice(0,2), to: uci.slice(2,4) };
}

function ratedKingInCheckSquare(game) {
  const inCheck =
    (typeof game?.in_check === 'function' && game.in_check()) ||
    (typeof game?.isCheck === 'function' && game.isCheck());
  if (!inCheck) return null;
  const color = game.turn();
  const board = game.board();
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (p?.type === 'k' && p.color === color)
      return `${String.fromCharCode(97+c)}${8-r}`;
  }
  return null;
}

function ratedCapturedFromMoves(moves=[]) {
  const game = new Chess(), white=[], black=[];
  for (const uci of moves) {
    const mover = game.turn();
    const m = game.move({
      from:String(uci).slice(0,2),
      to:String(uci).slice(2,4),
      promotion:String(uci).slice(4,5)||'q'
    });
    if (!m) break;
    if (m.captured) (mover === 'w' ? white : black).push(m.captured);
  }
  return {white,black};
}

function capturedGlyph(piece, byWhite) {
  const whiteCaptured = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛'};
  const blackCaptured = {p:'♙',n:'♘',b:'♗',r:'♖',q:'♕'};
  return (byWhite ? whiteCaptured : blackCaptured)[piece] || '';
}

function paintRatedCapturedMaterial(session=ratedMatchSession||ratedSpectatorSession) {
  const wrap=$('rated-captured-material');
  if(!wrap)return;
  if(!session){wrap.hidden=true;return;}
  const c=ratedCapturedFromMoves(session.moves||[]);
  $('rated-captured-by-white').innerHTML=c.white.map(p=>`<span>${capturedGlyph(p,true)}</span>`).join('')||'<small>None</small>';
  $('rated-captured-by-black').innerHTML=c.black.map(p=>`<span>${capturedGlyph(p,false)}</span>`).join('')||'<small>None</small>';
  wrap.hidden=false;
}

function stopRatedSpectating(){
  if(ratedSpectatorPollTimer)clearInterval(ratedSpectatorPollTimer);
  ratedSpectatorPollTimer=null;
  if(ratedSpectatorChannel){try{sb.removeChannel(ratedSpectatorChannel)}catch(_){}}
  ratedSpectatorChannel=null;
  ratedSpectatorSession=null;
}

function spectatorProjectedMs(color,s=ratedSpectatorSession,now=Date.now()){
  if(!s)return 0;
  const field=color==='w'?'white_time_ms':'black_time_ms';
  let left=Math.max(0,Number(s[field]??Number(s.base_seconds||0)*1000));
  if(s.status==='active'&&s.clock_running_color===color&&s.clock_started_at){
    const started=Date.parse(s.clock_started_at);
    if(Number.isFinite(started))left-=Math.max(0,now-started);
  }
  return Math.max(0,left);
}

function paintSpectator(){
  if(!ratedSpectatorSession)return;
  const s=ratedSpectatorSession,g=s.game,b=fenBoard(g.fen());
  const last=ratedLastMove(s),check=ratedKingInCheckSquare(g);
  $('web-bot-board').innerHTML=[8,7,6,5,4,3,2,1].flatMap(rank=>['a','b','c','d','e','f','g','h'].map(file=>{
    const sq=`${file}${rank}`,classes=[];
    if(last&&(sq===last.from||sq===last.to))classes.push('bot-last-square');
    if(sq===check)classes.push('rated-check-square');
    return `<button type="button" tabindex="-1" class="${classes.join(' ')}" data-spectator-square="${sq}">${webPiece(b[8-rank][file.charCodeAt(0)-97])}</button>`;
  })).join('');
  $('bot-move-list').innerHTML=renderDuelMoveRows(g.history());
  paintRatedCapturedMaterial(s);
  const white=$('rated-my-clock'),black=$('rated-opponent-clock'),now=Date.now();
  white.hidden=false;black.hidden=false;
  white.textContent=formatRatedClock(spectatorProjectedMs('w',s,now));
  black.textContent=formatRatedClock(spectatorProjectedMs('b',s,now));
  white.classList.toggle('running',s.clock_running_color==='w'&&s.status==='active');
  black.classList.toggle('running',s.clock_running_color==='b'&&s.status==='active');
}

function applySpectatorSnapshot(next){
  if(!next||!ratedSpectatorSession||next.id!==ratedSpectatorSession.id)return;
  ratedSpectatorSession={...ratedSpectatorSession,...next,game:chessFromRatedMoves(next.moves||[])};
  paintSpectator();
  $('bot-phase-label').textContent=next.status==='completed'?'Game finished':'Watching live';
  $('bot-game-message').textContent=next.status==='completed'
    ? ratedOnlineResultText(ratedSpectatorSession)
    : `${next.white_username||'White'} vs ${next.black_username||'Black'}`;
}

async function refreshSpectatorMatch(){
  if(!ratedSpectatorSession?.id)return;
  try{
    const {data,error}=await sb.rpc('get_spectator_rated_match',{target_match_id:ratedSpectatorSession.id});
    if(error)throw error;
    const fresh=Array.isArray(data)?data[0]:data;
    if(fresh){setRatedConnectionState('connected');applySpectatorSnapshot(fresh);}
  }catch(error){
    setRatedConnectionState('reconnecting');
    console.warn('Spectator refresh failed:',error);
  }
}

function subscribeSpectatorMatch(matchId){
  if(ratedSpectatorChannel){try{sb.removeChannel(ratedSpectatorChannel)}catch(_){}}
  setRatedConnectionState('reconnecting');
  ratedSpectatorChannel=sb.channel(`spectator-${matchId}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_rated_matches',filter:`id=eq.${matchId}`},payload=>{
      setRatedConnectionState('connected');applySpectatorSnapshot(payload.new);
    }).subscribe(status=>{
      if(status==='SUBSCRIBED')setRatedConnectionState('connected');
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setRatedConnectionState('reconnecting');
    });
  ratedSpectatorPollTimer=setInterval(refreshSpectatorMatch,1000);
}

async function openSpectatorMatch(matchId){
  stopRatedSpectating();
  const {data,error}=await sb.rpc('get_spectator_rated_match',{target_match_id:matchId});
  if(error)return toast(readableError(error));
  const m=Array.isArray(data)?data[0]:data;
  if(!m)return toast('That game is no longer available.');
  ratedMatchSession=null;
  ratedSpectatorSession={...m,game:chessFromRatedMoves(m.moves||[])};
  $('friend-profile-modal').hidden=true;
  $('bot-game-modal').hidden=false;
  $('bot-arena-label').textContent='LIVE SPECTATOR';
  $('bot-game-title').textContent='Live Rated Game';
  $('bot-game-subtitle').textContent=`${formatPoolName(m.pool)} · ${Math.round(m.base_seconds/60)}+${m.increment_seconds}`;
  if($('bot-player-role-label'))$('bot-player-role-label').textContent='WHITE';
  $('bot-player-color-label').textContent=m.white_username||'White';
  $('bot-opponent-label').textContent='BLACK';
  $('bot-strength-label').textContent=m.black_username||'Black';
  $('bot-sidebar-title').textContent='SPECTATING';
  $('bot-book-name').textContent=`${m.white_username||'White'} vs ${m.black_username||'Black'}`;
  $('bot-book-pgn').textContent=`${m.white_display_rating||'?'} vs ${m.black_display_rating||'?'}`;
  $('bot-status-title').textContent='LIVE STATUS';
  $('rated-offer-draw-button').hidden=true;
  $('rated-rematch-button').hidden=true;
  $('rated-draw-offer-panel').hidden=true;
  $('rated-rematch-panel').hidden=true;
  $('bot-resign-button').hidden=true;
  $('bot-restart-button').hidden=true;
  $('bot-review-button').hidden=true;
  $('clear-bot-arrows').hidden=true;
  paintSpectator();
  setRatedConnectionState('connected');
  subscribeSpectatorMatch(matchId);
}

async function refreshFriendSpectateButton(username){
  const btn=$('friend-profile-spectate');
  if(!btn)return;
  btn.hidden=true;btn.dataset.matchId='';
  if(!username)return;
  try{
    const {data,error}=await sb.rpc('get_friend_live_rated_match',{target_username:username});
    if(error)throw error;
    const m=Array.isArray(data)?data[0]:data;
    if(m?.id&&m.status==='active'){
      btn.hidden=false;btn.dataset.matchId=m.id;
      btn.textContent=`Spectate ${formatPoolName(m.pool)} ${Math.round(m.base_seconds/60)}+${m.increment_seconds}`;
    }
  }catch(error){console.warn('Could not check friend live game:',error);}
}

let ratedMatchSession = null;
let ratedMatchChannel = null;
let ratedMatchPollTimer = null;
let ratedMatchSelectedSquare = null;
let ratedMatchSyncBusy = false;

function chessFromRatedMoves(moves=[]) {
  const game = new Chess();
  for (const uci of (moves || [])) {
    if (!uci || String(uci).length < 4) break;
    const played = game.move({
      from: String(uci).slice(0,2),
      to: String(uci).slice(2,4),
      promotion: String(uci).slice(4,5) || 'q'
    });
    if (!played) break;
  }
  return game;
}

async function openRatedMatch(matchId) {
  clearRatedPremove();
  ratedMatchSelectedSquare = null;
  try {
    const { data, error } = await sb.rpc('get_rated_match', { target_match_id: matchId });
    if (error) throw error;
    const match = Array.isArray(data) ? data[0] : data;
    if (!match) throw new Error('Match not found.');

    ratedMatchSession = {
      ...match,
      game: chessFromRatedMoves(match.moves || []),
      localUserId: state.session.user.id,
      myColor: match.white_id === state.session.user.id ? 'w' : 'b',
      selected: null,
      lastMove: null
    };

    openRatedMatchModal();
    subscribeRatedMatch(matchId);
    resetMatchmakingUi();
  } catch (error) {
    $('matchmaking-status').textContent = error?.message || 'Could not open the match.';
  }
}

function ratedOnlineIsMyTurn() {
  return Boolean(ratedMatchSession && ratedMatchSession.status === 'active' && ratedMatchSession.game.turn() === ratedMatchSession.myColor);
}
function ratedOnlineResultText(session=ratedMatchSession) {
  if (!session || session.status !== 'completed') return '';
  if (session.result === '1-0') return 'White wins.';
  if (session.result === '0-1') return 'Black wins.';
  if (session.result === '1/2-1/2') return 'Draw.';
  return 'Game complete.';
}
function applyRatedMatchSnapshot(next) {
  if (!next || !ratedMatchSession || next.id !== ratedMatchSession.id) return;

  const previousMoves = Array.isArray(ratedMatchSession.moves) ? ratedMatchSession.moves : [];
  const nextMoves = Array.isArray(next.moves) ? next.moves : [];

  // Never allow an old poll to undo our optimistic move.
  if (ratedMatchSession.movePending && nextMoves.length < previousMoves.length) return;

  const previousStatus = ratedMatchSession.status;
  const positionChanged =
    previousMoves.length !== nextMoves.length ||
    previousMoves.some((move, index) => move !== nextMoves[index]) ||
    ratedMatchSession.status !== next.status ||
    ratedMatchSession.current_fen !== next.current_fen;

  const serverAdvanced = nextMoves.length > previousMoves.length;

  ratedMatchSession = {
    ...ratedMatchSession,
    ...next,
    game: chessFromRatedMoves(nextMoves),
    myColor: next.white_id === state.session.user.id ? 'w' : 'b',
    movePending: false
  };

  // Preserve a premove across the opponent's server-confirmed move.
  if (positionChanged && !ratedPremove) ratedMatchSelectedSquare = null;

  paintRatedOnlineGame();
  updateRatedOnlineStatus();
  paintRatedClocks();
  updateRatedNegotiationUI();
  paintRatedSupporterBadges();
  maybeNotifyRatedRematch();

  if (next.status === 'completed') {
    clearRatedPremove();
    $('bot-review-button').hidden = false;
    loadBozoRatings();
    stopRatedMatchPolling();
    stopRatedClockRenderer();
    if (previousStatus !== 'completed') setTimeout(() => showRatedPostGameSummary(ratedMatchSession), 350);
    return;
  }

  // One queued premove may execute only after an authoritative new move arrives
  // and the new position says it is now our turn.
  if (serverAdvanced && ratedPremove && ratedOnlineIsMyTurn()) {
    setTimeout(tryExecuteRatedPremove, 0);
  }
}
async function refreshRatedMatchFromServer() {
  if (!ratedMatchSession?.id || ratedMatchSyncBusy) return;
  ratedMatchSyncBusy=true;
  try {
    const {data,error}=await sb.rpc('get_rated_match',{target_match_id:ratedMatchSession.id});
    if(error) throw error;
    const fresh=Array.isArray(data)?data[0]:data;
    if(fresh){setRatedConnectionState('connected');applyRatedMatchSnapshot(fresh);}
  } catch(error) { setRatedConnectionState('reconnecting'); console.warn('Rated match refresh failed:',error); }
  finally { ratedMatchSyncBusy=false; }
}
function startRatedMatchPolling(){ stopRatedMatchPolling(); ratedMatchPollTimer=setInterval(refreshRatedMatchFromServer,500); }
function stopRatedMatchPolling(){ if(ratedMatchPollTimer) clearInterval(ratedMatchPollTimer); ratedMatchPollTimer=null; }
function openRatedMatchModal() {
  if (!ratedMatchSession || !$('bot-game-modal')) return;
  const nextOpponentUsername = String(ratedMatchSession.opponent_username || '').trim();
  if (ratedOpponentSupporterCache.username !== nextOpponentUsername) {
    ratedOpponentSupporterCache = {
      username: nextOpponentUsername,
      profile: null,
      pending: false,
      token: ratedOpponentSupporterCache.token + 1
    };
  }
  stopWebBotTurnMonitor(); webBotMovePromise=null; webBotSession=null; webBotSelectedSquare=null; ratedMatchSelectedSquare=null; botUserArrows=[];
  const s=ratedMatchSession;
  $('bot-game-modal').hidden=false; $('bot-arena-label').textContent='RATED ONLINE'; $('bot-game-title').textContent='Rated Online Game';
  $('bot-game-subtitle').textContent=`${formatPoolName(s.pool)} · ${Math.round(s.base_seconds/60)}+${s.increment_seconds}`;
  $('bot-opponent-label').textContent='OPPONENT'; $('bot-book-name').textContent=s.opponent_username || 'Online opponent';
  $('bot-book-pgn').textContent=`${s.my_display_rating || '?'} vs ${s.opponent_display_rating || '?'}`;
  $('bot-player-color-label').textContent=s.myColor==='w'?'White':'Black'; $('bot-strength-label').textContent=s.opponent_username || 'Opponent';
  $('bot-sidebar-title').textContent='OPPONENT'; $('bot-status-title').textContent='GAME STATUS'; $('bot-restart-button').hidden=true;
  $('rated-offer-draw-button').hidden=s.status!=='active';
  $('rated-rematch-button').hidden=s.status==='active';
  $('bot-review-button').hidden=s.status!=='completed'; $('bot-resign-button').hidden=false; $('clear-bot-arrows').hidden=false; if($('bot-player-role-label'))$('bot-player-role-label').textContent='YOU'; setRatedConnectionState('connected'); $('bot-eval-label').textContent='Rated'; $('bot-eval-white').style.width='50%';
  registerRatedOnlineBoardInput();
  paintRatedOnlineGame();
  updateRatedOnlineStatus();
  paintRatedClocks();
  updateRatedNegotiationUI();
  startRatedClockRenderer();
  startRatedMatchPolling();
}
function subscribeRatedMatch(matchId) {
  if(ratedMatchChannel){try{sb.removeChannel(ratedMatchChannel)}catch(_){}}
  setRatedConnectionState('reconnecting');
  ratedMatchChannel=sb.channel(`rated-match-${matchId}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_rated_matches',filter:`id=eq.${matchId}`},payload=>{
      setRatedConnectionState('connected');
      applyRatedMatchSnapshot(payload.new);
    })
    .subscribe(status=>{
      if(status==='SUBSCRIBED'){setRatedConnectionState('connected');refreshRatedMatchFromServer();}
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setRatedConnectionState('reconnecting');
      else if(status==='CLOSED')setRatedConnectionState('offline');
    });
}
function paintRatedOnlineGame() {
  if(!ratedMatchSession)return;
  const game=ratedMatchSession.game,board=fenBoard(game.fen()),orientation=ratedMatchSession.myColor==='w'?'white':'black';
  const ranks=orientation==='white'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const files=orientation==='white'?['a','b','c','d','e','f','g','h']:['h','g','f','e','d','c','b','a'];
  const targets=ratedMatchSelectedSquare&&ratedOnlineIsMyTurn()?game.moves({square:ratedMatchSelectedSquare,verbose:true}).map(m=>m.to):[];
  const last=ratedLastMove(ratedMatchSession),check=ratedKingInCheckSquare(game);
  $('web-bot-board').innerHTML=ranks.flatMap(rank=>files.map(file=>{
    const sq=`${file}${rank}`,sym=board[8-rank][file.charCodeAt(0)-97],c=[];
    if(last&&(sq===last.from||sq===last.to))c.push('bot-last-square');
    if(sq===check)c.push('rated-check-square');
    if(sq===ratedMatchSelectedSquare)c.push('bot-selected-square');
    if(targets.includes(sq))c.push('bot-legal-square');
    return `<button type="button" class="${c.join(' ')}" data-rated-square="${sq}">${webPiece(sym)}</button>`;
  })).join('');
  paintBotUserAnnotations();
  paintRatedPremove();
  paintRatedCapturedMaterial(ratedMatchSession);
  $('bot-move-list').innerHTML=renderDuelMoveRows(game.history());
}
async function executeRatedOnlineCandidate(candidate, fromPremove=false) {
  if (!ratedMatchSession || ratedMatchSession.status !== 'active' || ratedMatchSession.movePending) return false;
  if (!ratedOnlineIsMyTurn()) return false;

  ratedMatchSelectedSquare = null;
  const beforeSnapshot = {
    ...ratedMatchSession,
    moves: [...(Array.isArray(ratedMatchSession.moves) ? ratedMatchSession.moves : [])],
    game: chessFromRatedMoves(ratedMatchSession.moves || [])
  };

  const uci = `${candidate.from}${candidate.to}${candidate.promotion || ''}`;
  const optimisticMoves = [...beforeSnapshot.moves, uci];
  const moverColor = beforeSnapshot.game.turn();
  const nextColor = moverColor === 'w' ? 'b' : 'w';
  const moverProjected = ratedClockProjectedMs(moverColor, beforeSnapshot);
  const incrementMs = Math.max(0, Number(beforeSnapshot.increment_seconds || 0) * 1000);
  const nowIso = new Date().toISOString();
  const optimisticClockPatch = moverColor === 'w'
    ? { white_time_ms: moverProjected + incrementMs }
    : { black_time_ms: moverProjected + incrementMs };

  ratedMatchSession = {
    ...ratedMatchSession,
    ...optimisticClockPatch,
    moves: optimisticMoves,
    game: chessFromRatedMoves(optimisticMoves),
    clock_running_color: nextColor,
    clock_started_at: nowIso,
    movePending: true,
    draw_offer_by: null,
    draw_offer_at: null
  };

  paintRatedOnlineGame();
  paintRatedClocks();
  updateRatedNegotiationUI();
  $('bot-game-message').textContent = fromPremove
    ? 'Premove played. Waiting for your opponent.'
    : 'Waiting for your opponent to move.';

  const response = await submitRatedOnlineMove(candidate);

  if (!response?.ok) {
    ratedMatchSession = { ...beforeSnapshot, movePending: false };
    paintRatedOnlineGame();
    paintRatedClocks();
    updateRatedOnlineStatus();
    updateRatedNegotiationUI();
    $('bot-game-message').textContent = response?.error || 'The server rejected that move.';
    return false;
  }

  ratedMatchSession = {
    ...ratedMatchSession,
    current_fen: response.fen || ratedMatchSession.current_fen,
    status: response.status || ratedMatchSession.status,
    result: response.result ?? ratedMatchSession.result,
    white_time_ms: response.white_time_ms ?? ratedMatchSession.white_time_ms,
    black_time_ms: response.black_time_ms ?? ratedMatchSession.black_time_ms,
    clock_running_color: response.clock_running_color ?? ratedMatchSession.clock_running_color,
    clock_started_at: response.clock_started_at ?? ratedMatchSession.clock_started_at,
    movePending: false
  };

  setRatedConnectionState('connected');
  paintRatedOnlineGame();
  paintRatedClocks();
  updateRatedOnlineStatus();
  updateRatedNegotiationUI();
  setTimeout(() => refreshRatedMatchFromServer(), 20);
  return true;
}

async function handleRatedOnlineSquare(square) {
  if (!ratedMatchSession || ratedMatchSession.status !== 'active') return;
  if (ratedMatchSession.movePending) return;

  const game = ratedMatchSession.game;
  const piece = game.get(square);
  const myTurn = ratedOnlineIsMyTurn();

  if (!myTurn) {
    // Premove selection is allowed only with our own piece.
    if (!ratedMatchSelectedSquare) {
      if (piece && piece.color === ratedMatchSession.myColor) {
        ratedMatchSelectedSquare = square;
        paintRatedOnlineGame();
      }
      return;
    }

    if (piece && piece.color === ratedMatchSession.myColor) {
      ratedMatchSelectedSquare = square;
      paintRatedOnlineGame();
      return;
    }

    const from = ratedMatchSelectedSquare;
    const movingPiece = game.get(from);
    ratedMatchSelectedSquare = null;

    if (!movingPiece || movingPiece.color !== ratedMatchSession.myColor) {
      paintRatedOnlineGame();
      return;
    }

    // We don't submit anything now. We store ONE provisional move only.
    queueRatedPremove(from, square, 'q');
    return;
  }

  if (!ratedMatchSelectedSquare) {
    if (piece && piece.color === ratedMatchSession.myColor) {
      ratedMatchSelectedSquare = square;
      paintRatedOnlineGame();
    }
    return;
  }

  if (piece && piece.color === ratedMatchSession.myColor) {
    ratedMatchSelectedSquare = square;
    paintRatedOnlineGame();
    return;
  }

  const from = ratedMatchSelectedSquare;
  ratedMatchSelectedSquare = null;
  const candidate = game.moves({ square: from, verbose: true }).find(move => move.to === square);

  if (!candidate) {
    paintRatedOnlineGame();
    $('bot-game-message').textContent = 'That move is not legal.';
    return;
  }

  // A manual move always cancels the single queued premove.
  clearRatedPremove();
  await executeRatedOnlineCandidate(candidate, false);
}
async function submitRatedOnlineMove(move) {
  if (!ratedMatchSession?.id || !move) {
    return { ok: false, error: 'The rated match is missing its server id.' };
  }

  const uci = `${move.from}${move.to}${move.promotion || ''}`;

  try {
    const { data, error } = await sb.functions.invoke('rated-match', {
      body: {
        action: 'move',
        matchId: ratedMatchSession.id,
        move: uci
      }
    });

    if (error) {
      let message = error.message || 'The rated-match function rejected the request.';
      try {
        const context = await error.context?.json?.();
        if (context?.error) message = context.error;
      } catch (_) {}
      return { ok: false, error: message };
    }

    if (data?.error) {
      return { ok: false, error: data.error };
    }

    if (!data?.ok) {
      return { ok: false, error: 'The rated-match function returned no success acknowledgement.' };
    }

    return {
      ok: true,
      fen: data.fen,
      san: data.san,
      status: data.status,
      result: data.result,
      white_time_ms: data.white_time_ms,
      black_time_ms: data.black_time_ms,
      clock_running_color: data.clock_running_color,
      clock_started_at: data.clock_started_at
    };
  } catch (error) {
    console.warn('Rated move transport failed:', error);
    return {
      ok: false,
      error: error?.message || 'Could not reach the rated-match server.'
    };
  }
}
function updateRatedOnlineStatus(){
  if(!ratedMatchSession)return;
  $('bot-phase-label').textContent=ratedMatchSession.status==='completed'?'Finished':'Rated online';
  if(ratedMatchSession.status==='completed'){
    $('bot-turn-badge').textContent='Game complete';
    $('bot-game-message').textContent=ratedOnlineResultText();
    return;
  }
  const mine=ratedOnlineIsMyTurn();
  $('bot-turn-badge').textContent=mine?'Your move':'Opponent to move';
  if (!ratedMatchSession.clock_started_at && ratedMatchSession.game.history().length === 0) {
    $('bot-game-message').textContent = mine
      ? 'Your move. The clock starts after White plays.'
      : 'Waiting for White. The clock starts after the first move.';
  } else {
    $('bot-game-message').textContent=mine?'Your move.':'Waiting for your opponent to move.';
  }
}


/* ============================================================
   BOZO v4.0: FREE PLAY
   Uses the same BOZO Bot board/game implementation as Opening
   Duels, but starts from the standard initial position with no
   required book moves.
   ============================================================ */

let playSection = 'quick';

$$('[data-mobile-play-section]').forEach(button => button.addEventListener('click', () => {
  playSection = button.dataset.mobilePlaySection === 'arenas' ? 'arenas' : 'quick';
  paintPlaySection();
  if (playSection === 'arenas') loadArenas();
}));
let arenaFilter = 'live';
let arenaRows = [];
let myClubRows = [];

async function renderPlay() {
  paintPlaySection();

  const ratings = await loadBozoRatings();

  if (
    playSection === 'quick' &&
    state.session?.user &&
    !playRatingPromptShown &&
    (!ratings || ratings.length === 0)
  ) {
    playRatingPromptShown = true;
    const poolSelect = $('matchmaking-pool');
    if (poolSelect) poolSelect.value = 'rapid';
    syncTimeToMatchmakingPool();

    const message = $('rating-setup-message');
    if (message) {
      message.textContent = 'Choose a starting estimate for rated matchmaking. You can set the other pools later.';
    }
    openRatingSetup('rapid');
  }

  if (playSection === 'arenas') loadArenas();
}

function paintPlaySection() {
  $('play-quick-section').hidden = playSection !== 'quick';
  $('play-arenas-section').hidden = playSection !== 'arenas';
  $$('[data-play-section]').forEach(b => b.classList.toggle('active', b.dataset.playSection === playSection));
}

$$('[data-play-section]').forEach(button => button.addEventListener('click', () => {
  playSection = button.dataset.playSection;
  paintPlaySection();
  if (playSection === 'arenas') loadArenas();
}));

$$('[data-arena-filter]').forEach(button => button.addEventListener('click', () => {
  arenaFilter = button.dataset.arenaFilter;
  $$('[data-arena-filter]').forEach(b => b.classList.toggle('active', b === button));
  loadArenas();
}));

async function loadArenas() {
  const out = $('arena-list');
  if (!out) return;
  out.innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading arenas…</b></div>';
  // Creates any missing official scheduled rotation events, then lists the selected view.
  if (state.session) {
    try { await sb.rpc('bozo_ensure_official_arenas'); } catch (error) { console.warn('Official arena rotation:', error); }
  }
  const { data, error } = await sb.rpc('bozo_list_arenas', { list_mode: arenaFilter });
  if (error) {
    out.innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  arenaRows = data || [];
  paintArenas();
}

function arenaTypeLabel(a) {
  if (a.is_official) return '✓ BOZO OFFICIAL';
  if (a.host_type === 'club_clash') return 'CLUB CLASH';
  if (a.host_type === 'club') return 'CLUB HOSTED';
  return 'PLAYER HOSTED';
}

function paintArenas() {
  const out = $('arena-list');
  if (!arenaRows.length) {
    out.innerHTML = '<div class="empty-state"><div>♜</div><b>No arenas in this view</b><span>Create one or check another filter.</span></div>';
    return;
  }
  out.innerHTML = arenaRows.map(a => {
    const start = new Date(a.starts_at);
    const end = new Date(a.ends_at);
    const now = Date.now();
    const live = start.getTime() <= now && end.getTime() > now;
    return `<article class="arena-card ${a.is_official ? 'official' : ''}">
      <div class="arena-card-head"><span>${arenaTypeLabel(a)}</span><b>${live ? 'LIVE' : start.toLocaleString()}</b></div>
      <h3>${escapeHtml(a.name)}</h3>
      <p>${escapeHtml(a.time_control)} · ${a.rated ? 'Rated' : 'Unrated'} · ${Math.round((end-start)/60000)} min${a.position_type !== 'standard' ? ` · ${escapeHtml(a.position_label || a.position_type.toUpperCase())}` : ''}</p>
      ${a.host_type === 'club_clash' ? `<div class="arena-club-mode">Club scoring: ${a.club_scoring_mode === 'combined' ? 'Combined' : 'Top 10'}</div>` : ''}
      <div class="arena-card-meta"><span>${Number(a.player_count || 0)} players</span><span>${escapeHtml(a.visibility)}</span></div>
      <div class="arena-card-actions">
        <button class="button secondary small" data-arena-open="${a.id}">View arena</button>
        <button class="button ${live ? 'primary':'secondary'} small" data-arena-join="${a.id}" ${a.joined?'disabled':''}>${a.joined ? 'Joined' : live ? 'Join arena' : 'Register'}</button>
      </div>
    </article>`;
  }).join('');

  out.querySelectorAll('[data-arena-open]').forEach(b => b.addEventListener('click', () => openArenaDetail(b.dataset.arenaOpen)));

  out.querySelectorAll('[data-arena-join]').forEach(b => b.addEventListener('click', async () => {
    if (!state.session) return openAuth('signin');
    const { error } = await sb.rpc('bozo_join_arena', { target_arena_id: b.dataset.arenaJoin, join_code_value: null });
    if (error) return toast(readableError(error));
    toast('Arena joined.');
    await loadArenas();
  }));
}


let activeArenaDetailId = null;
let activeArenaDetailTab = 'standings';
let activeArenaDetail = null;
let arenaDetailTimer = null;

function closeArenaDetail() {
  activeArenaDetailId = null;
  clearInterval(arenaDetailTimer);
  arenaDetailTimer = null;
  $('arena-detail-modal').hidden = true;
}

$('close-arena-detail')?.addEventListener('click', closeArenaDetail);
$('arena-detail-modal')?.addEventListener('click', event => {
  if (event.target === $('arena-detail-modal')) closeArenaDetail();
});
$$('[data-arena-detail-tab]').forEach(button => button.addEventListener('click', () => {
  activeArenaDetailTab = button.dataset.arenaDetailTab;
  $$('[data-arena-detail-tab]').forEach(b => b.classList.toggle('active', b === button));
  paintArenaDetailTab();
}));

async function openArenaDetail(arenaId) {
  activeArenaDetailId = arenaId;
  activeArenaDetailTab = 'standings';
  $$('[data-arena-detail-tab]').forEach(b => b.classList.toggle('active', b.dataset.arenaDetailTab === 'standings'));
  $('arena-detail-modal').hidden = false;
  $('arena-detail-body').innerHTML = '<div class="empty-state"><div>⌛</div><b>Loading arena…</b></div>';
  await refreshArenaDetail();
  clearInterval(arenaDetailTimer);
  arenaDetailTimer = setInterval(() => {
    if (activeArenaDetailId) refreshArenaDetail(true);
  }, 5000);
}

async function refreshArenaDetail(silent=false) {
  if (!activeArenaDetailId) return;
  const { data, error } = await sb.rpc('bozo_get_arena_detail', { target_arena_id:activeArenaDetailId });
  if (error) {
    if (!silent) $('arena-detail-body').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  activeArenaDetail = Array.isArray(data) ? data[0] : data;
  paintArenaDetailHeader();
  paintArenaDetailActions();
  await paintArenaDetailTab(silent);
}

function paintArenaDetailHeader() {
  const a = activeArenaDetail;
  if (!a) return;
  const now = Date.now();
  const start = new Date(a.starts_at);
  const end = new Date(a.ends_at);
  const live = start.getTime() <= now && end.getTime() > now;
  $('arena-detail-header').innerHTML = `
    <span class="eyebrow">${a.is_official ? '✓ BOZO OFFICIAL' : escapeHtml(String(a.host_type||'player').replace('_',' ').toUpperCase())}</span>
    <h2>${escapeHtml(a.name)}</h2>
    <p>${escapeHtml(a.time_control)} · ${a.rated ? 'Rated' : 'Unrated'} · ${live ? 'LIVE NOW' : start > new Date() ? start.toLocaleString() : 'Finished'} · ${Number(a.player_count||0)} players</p>`;
}

function paintArenaDetailActions() {
  const a = activeArenaDetail;
  if (!a) return;
  const actions = [];
  if (!a.joined && new Date(a.ends_at).getTime() > Date.now()) actions.push(`<button id="arena-detail-join" class="button primary">${new Date(a.starts_at).getTime() <= Date.now() ? 'Join arena' : 'Register'}</button>`);
  if (a.joined && new Date(a.ends_at).getTime() > Date.now()) actions.push('<button id="arena-detail-leave" class="button ghost">Leave arena</button>');
  if (a.can_cancel && new Date(a.ends_at).getTime() > Date.now()) actions.push('<button id="arena-detail-cancel" class="button ghost">Cancel arena</button>');
  $('arena-detail-actions').innerHTML = actions.join('');

  $('arena-detail-join')?.addEventListener('click', async () => {
    const { error } = await sb.rpc('bozo_join_arena', { target_arena_id:a.id, join_code_value:null });
    if (error) return toast(readableError(error));
    toast('Arena joined.'); await refreshArenaDetail(); loadArenas();
  });
  $('arena-detail-leave')?.addEventListener('click', async () => {
    if (!confirm('Leave this arena? Your existing arena results remain in the standings.')) return;
    const { error } = await sb.rpc('bozo_leave_arena', { target_arena_id:a.id });
    if (error) return toast(readableError(error));
    toast('Left arena.'); await refreshArenaDetail(); loadArenas();
  });
  $('arena-detail-cancel')?.addEventListener('click', async () => {
    if (!confirm('Cancel this arena?')) return;
    const { error } = await sb.rpc('bozo_cancel_arena', { target_arena_id:a.id });
    if (error) return toast(readableError(error));
    toast('Arena cancelled.'); closeArenaDetail(); loadArenas();
  });
}

async function paintArenaDetailTab(silent=false) {
  const body = $('arena-detail-body');
  const a = activeArenaDetail;
  if (!a) return;

  if (activeArenaDetailTab === 'standings') {
    const { data, error } = await sb.rpc('bozo_arena_standings', { target_arena_id:a.id });
    if (error) {
      if (!silent) body.innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
      return;
    }
    const rows = data || [];
    body.innerHTML = rows.length ? `<div class="arena-standing-list">${rows.map((p,i)=>`
      <article class="${p.user_id===state.session?.user?.id?'me':''}">
        <b class="standing-rank">${i+1}</b>
        <div class="standing-player"><strong>${escapeHtml(p.ign||p.username||'Player')}</strong><span>@${escapeHtml(p.username||'')} · ${p.games_played} games · ${p.wins}W ${p.draws}D ${p.losses}L · best streak ${p.best_streak}</span></div>
        <b class="standing-score">${p.score}</b>
      </article>`).join('')}</div>` :
      '<div class="empty-state"><div>♟</div><b>No scores yet</b><span>Players will appear here as they join and complete arena games.</span></div>';
    return;
  }

  if (activeArenaDetailTab === 'clubs') {
    if (a.host_type !== 'club_clash') {
      body.innerHTML = '<div class="empty-state"><div>♜</div><b>Individual arena</b><span>Club standings appear only in Club Clash arenas.</span></div>';
      return;
    }
    const { data, error } = await sb.rpc('bozo_club_arena_standings', { target_arena_id:a.id });
    if (error) return body.innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    const rows = data || [];
    body.innerHTML = rows.length ? `<div class="arena-standing-list club">${rows.map((r,i)=>`
      <article><b class="standing-rank">${i+1}</b><div class="standing-player"><strong>${escapeHtml(r.club_name)}</strong><span>${r.counting_players}/${r.total_players} scorers counting · ${a.club_scoring_mode==='combined'?'Combined':'Top 10'}</span></div><b class="standing-score">${r.club_score}</b></article>`).join('')}</div>` :
      '<div class="empty-state"><div>♜</div><b>No club scores yet</b></div>';
    return;
  }

  body.innerHTML = `
    <div class="community-stat-grid">
      <article><b>${escapeHtml(a.time_control)}</b><span>Time control</span></article>
      <article><b>${a.rated?'Rated':'Casual'}</b><span>Rating</span></article>
      <article><b>${Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000)}m</b><span>Duration</span></article>
      <article><b>${Number(a.player_count||0)}</b><span>Players</span></article>
    </div>
    <section class="community-section">
      <span class="eyebrow">STARTING POSITION</span>
      <h3>${escapeHtml(a.position_label || 'Standard chess')}</h3>
      ${a.fen ? `<code class="arena-fen-code">${escapeHtml(a.fen)}</code>` : ''}
    </section>
    ${a.host_type==='club_clash' ? `<section class="community-section"><span class="eyebrow">CLUB SCORING</span><h3>${a.club_scoring_mode==='combined'?'Combined member score':'Top 10 scorers count'}</h3></section>` : ''}
    <section class="community-section arena-engine-note"><span class="eyebrow">ARENA PLAY</span><p>BOZO tracks registration, standings, streaks, and club scoring here. The dedicated continuous arena pairing bridge is being hardened separately before rated arena games are enabled.</p></section>`;
}

$('create-arena-button')?.addEventListener('click', async () => {
  if (!state.session) return openAuth('signin');
  $('create-arena-modal').hidden = false;
  $('arena-create-status').textContent = '';
  await loadMyClubsForArena();
  await loadArenaOpeningOptions();
  paintArenaCreateOptions();
});
$('close-create-arena')?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  $('create-arena-modal').hidden = true;
});
$('create-arena-modal')?.addEventListener('click', (event) => {
  if (event.target === $('create-arena-modal')) $('create-arena-modal').hidden = true;
});

async function loadMyClubsForArena() {
  const { data } = await sb.rpc('bozo_list_clubs', { list_mode:'mine' });
  myClubRows = data || [];
  const select = $('arena-host-club');
  select.innerHTML = '<option value="">Choose club</option>' + myClubRows
    .filter(c => ['owner','admin'].includes(c.my_role))
    .map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function loadArenaOpeningOptions() {
  const select = $('arena-opening-id');
  if (select.dataset.loaded === '1') return;
  const rows=[],pageSize=1000;
  for(let from=0;from<5000;from+=pageSize){
    const {data,error}=await sb.from('openings').select('id,name,variation').eq('status','published').order('name').range(from,from+pageSize-1);
    if(error){console.warn('Could not load arena opening options:',error);break;}
    rows.push(...(data||[]));
    if(!data||data.length<pageSize)break;
  }
  select.innerHTML = '<option value="">Choose an opening</option>' + rows.map(o =>
    `<option value="${o.id}" data-search="${escapeHtml(`${o.name} ${o.variation || ''}`.toLowerCase())}">${escapeHtml(o.name)}${o.variation ? ': '+escapeHtml(o.variation) : ''}</option>`
  ).join('');
  select.dataset.loaded = '1';
}
$('arena-opening-search')?.addEventListener('input', () => {
  const q = $('arena-opening-search').value.trim().toLowerCase();
  [...$('arena-opening-id').options].forEach((o,i) => { if (i) o.hidden = q && !String(o.dataset.search||'').includes(q); });
});

function paintArenaCreateOptions() {
  const hostType = $('arena-host-type').value;
  const clubBased = hostType === 'club' || hostType === 'club_clash';
  $('arena-host-club-wrap').hidden = !clubBased;
  $('arena-clash-clubs-wrap').hidden = hostType !== 'club_clash';
  $('arena-club-scoring-wrap').hidden = hostType !== 'club_clash';
  const positionType = $('arena-position-type').value;
  $('arena-opening-wrap').hidden = positionType !== 'opening';
  $('arena-fen-wrap').hidden = positionType !== 'fen';
  $('arena-start-time-wrap').hidden = $('arena-start-mode').value !== 'scheduled';
}
['arena-host-type','arena-position-type','arena-start-mode'].forEach(id => $(id)?.addEventListener('change', paintArenaCreateOptions));

$('submit-create-arena')?.addEventListener('click', async () => {
  const hostType = $('arena-host-type').value;
  const positionType = $('arena-position-type').value;
  const payload = {
    arena_name: $('arena-name-input').value.trim(),
    host_type_value: hostType,
    host_club_id_value: $('arena-host-club').value || null,
    visibility_value: $('arena-visibility').value,
    rated_value: $('arena-rated').value === 'true',
    time_control_value: $('arena-time-control').value,
    duration_minutes_value: Number($('arena-duration').value),
    starts_at_value: $('arena-start-mode').value === 'now' ? new Date().toISOString() : new Date($('arena-start-time').value).toISOString(),
    position_type_value: positionType,
    opening_id_value: positionType === 'opening' ? ($('arena-opening-id').value || null) : null,
    fen_value: positionType === 'fen' ? $('arena-fen-input').value.trim() : null,
    club_scoring_mode_value: hostType === 'club_clash' ? $('arena-club-scoring').value : null,
    invited_club_slugs_value: hostType === 'club_clash'
      ? $('arena-clash-clubs').value.split(',').map(v => v.trim().replace(/^@/,'')).filter(Boolean)
      : []
  };
  if (payload.arena_name.length < 3) return $('arena-create-status').textContent = 'Give the arena a name.';
  if ((hostType === 'club' || hostType === 'club_clash') && !payload.host_club_id_value) return $('arena-create-status').textContent = 'Choose a club you manage.';
  if (positionType === 'opening' && !payload.opening_id_value) return $('arena-create-status').textContent = 'Choose an opening.';
  if (positionType === 'fen' && !payload.fen_value) return $('arena-create-status').textContent = 'Paste a FEN.';
  const { error } = await sb.rpc('bozo_create_arena', payload);
  if (error) return $('arena-create-status').textContent = readableError(error);
  $('create-arena-modal').hidden = true;
  toast('Arena created.');
  playSection = 'arenas'; arenaFilter = 'mine'; paintPlaySection(); await loadArenas();
});

function startBozoFreePlay() {
  const strengthKey = $('freeplay-strength')?.value || 'club';
  const strength = BOT_STRENGTHS[strengthKey] || BOT_STRENGTHS.club;
  const colorChoice = $('freeplay-color')?.value || 'white';
  const playerColor = colorChoice === 'random'
    ? (Math.random() < .5 ? 'w' : 'b')
    : (colorChoice === 'black' ? 'b' : 'w');

  webBotSession = {
    opening: null,
    game: new Chess(),
    bookSans: [],
    requiredBookPlies: 0,
    playerColor,
    strengthKey,
    strength,
    phase: 'freeplay',
    status: 'active',
    resultReason: '',
    moves: [],
    selected: null,
    lastMove: null,
    botThinking: false,
    startedAt: Date.now(),
    freePlay: true
  };

  $('bot-game-modal').hidden = false;
  hideRatedClocks();
  $('rated-offer-draw-button').hidden = true;
  $('rated-rematch-button').hidden = true;
  $('rated-draw-offer-panel').hidden = true;
  $('rated-rematch-panel').hidden = true;
  $('bot-arena-label').textContent = 'BOZO BOT ARENA';
  $('bot-opponent-label').textContent = 'BOZO BOT';
  $('bot-sidebar-title').textContent = 'SELECTED LINE';
  $('bot-status-title').textContent = 'TRAINING STATUS';
  $('bot-game-title').textContent = 'Free Play vs BOZO Bot';
  $('bot-game-subtitle').textContent = `Unrestricted game · ${strength.label}`;
  $('bot-book-name').textContent = 'Starting position';
  $('bot-book-pgn').textContent = 'No opening is locked. Play any legal move.';
  $('bot-player-color-label').textContent = playerColor === 'w' ? 'White' : 'Black';
  $('bot-strength-label').textContent = strength.label;
  $('bot-review-button').hidden = true;
  botUserArrows = [];
  webBotSelectedSquare = null;

  paintWebBotGame();
  updateWebBotStatus();
  startWebBotTurnMonitor();
  $('bot-eval-label').textContent = 'Paused';
  $('bot-eval-white').style.width = '50%';

  if (!webBotIsPlayerTurn()) requestWebBotMove('freeplay-start');
}

/* ============================================================
   BOZO BOT: OPENING-LOCKED PRACTICE + STOCKFISH FREE PLAY
   ============================================================ */

const BOT_STRENGTHS = {
  beginner: { label: 'Beginner', depth: 5, randomness: 0.24 },
  casual: { label: 'Casual', depth: 7, randomness: 0.08 },
  club: { label: 'Club', depth: 11, randomness: 0 },
  advanced: { label: 'Advanced', depth: 14, randomness: 0 },
  master: { label: 'BOZO Master', depth: 17, randomness: 0 }
};

let webBotSession = null;
let webBotSelectedSquare = null;
let webBotAnalysisToken = 0;
// webBotMoveEngine is declared with Review state above to avoid TDZ errors.
webBotMoveEngine = null;
let webBotTurnWatchdog = null;
let webBotTurnMonitor = null;
let webBotMovePromise = null;
let botUserArrows = [];
let botArrowStart = null;
let botRightMouseDown = false;
let ratedAnnotationStart = null;
let ratedAnnotationDragging = false;

function ratedSquareFromTarget(target) {
  const button = target?.closest?.('[data-rated-square]');
  return button?.dataset?.ratedSquare || '';
}

function registerRatedOnlineBoardInput() {
  const board = $('web-bot-board');
  if (!board || board.dataset.ratedInputReady === '1') return;
  board.dataset.ratedInputReady = '1';

  // Persistent delegated left-click handler. It survives every innerHTML repaint.
  board.addEventListener('click', event => {
    if (!ratedMatchSession) return;
    const square = ratedSquareFromTarget(event.target);
    if (!square) return;
    event.preventDefault();
    handleRatedOnlineSquare(square);
  });

  // Right-click / right-drag annotations for rated online games.
  board.addEventListener('mousedown', event => {
    if (!ratedMatchSession || event.button !== 2) return;
    const square = ratedSquareFromTarget(event.target);
    if (!square) return;
    event.preventDefault();
    ratedAnnotationStart = square;
    ratedAnnotationDragging = true;
  });

  board.addEventListener('mouseup', event => {
    if (!ratedMatchSession || event.button !== 2 || !ratedAnnotationDragging) return;
    const end = ratedSquareFromTarget(event.target);
    const start = ratedAnnotationStart;
    ratedAnnotationStart = null;
    ratedAnnotationDragging = false;
    event.preventDefault();

    if (!start || !end) return;
    if (start === end) toggleBotSquareHighlight(start);
    else addBotUserArrow(start, end);
  });

  board.addEventListener('contextmenu', event => {
    if (!ratedMatchSession) return;
    const square = ratedSquareFromTarget(event.target);
    if (!square) return;
    event.preventDefault();
  });

  window.addEventListener('mouseup', event => {
    if (event.button === 2 && ratedAnnotationDragging) {
      ratedAnnotationStart = null;
      ratedAnnotationDragging = false;
    }
  });
}

async function startWebBotGameFromSetup() {
  const openingId = $('duel-opening-id').value;
  if (!openingId) {
    $('duel-create-status').textContent = 'Choose a cloud opening line first.';
    return;
  }

  const button = $('send-opening-duel');
  button.disabled = true;
  button.textContent = 'Loading line…';
  $('duel-create-status').textContent = '';

  try {
    const { data: opening, error } = await sb.from('openings')
      .select('id,eco,name,variation,pgn')
      .eq('id', openingId)
      .single();

    if (error) throw error;

    const parser = new Chess();
    const loaded = parser.load_pgn(opening.pgn || '', { sloppy: true });
    if (!loaded) throw new Error('The selected opening line contains invalid move text.');

    const bookSans = parser.history();
    if (!bookSans.length) throw new Error('The selected line contains no moves.');

    const strengthKey = $('bot-strength').value;
    const strength = BOT_STRENGTHS[strengthKey] || BOT_STRENGTHS.club;
    const playerColor = $('duel-color').value === 'black' ? 'b' : 'w';
    const requestedBookPlies = Number($('duel-required-plies').value);
    const requiredBookPlies = Math.min(requestedBookPlies, bookSans.length);

    webBotSession = {
      opening,
      game: new Chess(),
      bookSans,
      requiredBookPlies,
      playerColor,
      strengthKey,
      strength,
      phase: 'book',
      status: 'active',
      resultReason: '',
      moves: [],
      selected: null,
      lastMove: null,
      botThinking: false,
      startedAt: Date.now()
    };

    $('challenge-create-modal').hidden = true;
    $('bot-game-modal').hidden = false;
    hideRatedClocks();
    $('rated-offer-draw-button').hidden = true;
    $('rated-rematch-button').hidden = true;
    $('rated-draw-offer-panel').hidden = true;
    $('rated-rematch-panel').hidden = true;
    $('bot-arena-label').textContent = 'BOZO BOT ARENA';
    $('bot-opponent-label').textContent = 'BOZO BOT';
    $('bot-sidebar-title').textContent = 'SELECTED LINE';
    $('bot-status-title').textContent = 'TRAINING STATUS';
    $('bot-game-title').textContent =
      `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
    $('bot-game-subtitle').textContent =
      `${opening.eco || 'ECO  - '} · ${Math.ceil(requiredBookPlies / 2)} required book moves`;
    $('bot-book-name').textContent =
      `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
    $('bot-book-pgn').textContent = opening.pgn || '';
    $('bot-player-color-label').textContent = playerColor === 'w' ? 'White' : 'Black';
    $('bot-strength-label').textContent = strength.label;
    $('bot-review-button').hidden = true;
    botUserArrows = [];
    webBotSelectedSquare = null;

    paintWebBotGame();
    updateWebBotStatus();
    startWebBotTurnMonitor();
    $('bot-eval-label').textContent = 'Paused';
    $('bot-eval-white').style.width = '50%';

    if (!webBotIsPlayerTurn()) {
      requestWebBotMove('game-start');
    }
  } catch (error) {
    console.error(error);
    $('duel-create-status').textContent =
      error?.message || 'BOZO Bot could not start.';
  } finally {
    button.disabled = false;
    button.textContent = 'Start training game';
  }
}

function closeWebBotGame() {
  stopRatedSpectating();
  stopRatedMatchPolling();
  if(ratedMatchChannel){try{sb.removeChannel(ratedMatchChannel)}catch(_){} ratedMatchChannel=null;}
  ratedMatchSession=null; ratedMatchSelectedSquare=null; ratedMatchSyncBusy=false; clearRatedPremove();
  $('bot-restart-button').hidden=false;
  clearTimeout(webBotTurnWatchdog);
  webBotTurnWatchdog = null;
  stopWebBotTurnMonitor();
  webBotMovePromise = null;
  $('bot-game-modal').hidden = true;
  $('rated-connection-status').hidden=true;
  $('rated-captured-material').hidden=true;
  $('bot-resign-button').hidden=false;
  $('clear-bot-arrows').hidden=false;
  webBotAnalysisToken++;
  webBotSession = null;
  webBotSelectedSquare = null;
  botUserArrows = [];

  resetManagedStockfish();
}

function webBotIsPlayerTurn() {
  return Boolean(
    webBotSession &&
    webBotSession.game.turn() === webBotSession.playerColor
  );
}

function webBotBookMoveAtPly(ply = webBotSession?.game.history().length || 0) {
  return webBotSession?.bookSans?.[ply] || null;
}

function webBotStillMatchesBook() {
  if (!webBotSession) return false;
  const history = webBotSession.game.history().map(reviewCleanSan);
  return history.every((move, index) =>
    reviewCleanSan(webBotSession.bookSans[index]) === move
  );
}

function webBotBookPhaseActive() {
  if (!webBotSession) return false;
  const ply = webBotSession.game.history().length;
  return (
    ply < webBotSession.requiredBookPlies &&
    ply < webBotSession.bookSans.length &&
    webBotStillMatchesBook()
  );
}

function updateWebBotPhase() {
  if (!webBotSession || webBotSession.status !== 'active') return;
  webBotSession.phase = webBotBookPhaseActive() ? 'book' : 'freeplay';
}

function paintWebBotGame() {
  if (!webBotSession) return;

  const game = webBotSession.game;
  const board = fenBoard(game.fen());
  const orientation = webBotSession.playerColor === 'w' ? 'white' : 'black';
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const legalTargets = webBotSelectedSquare
    ? game.moves({ square: webBotSelectedSquare, verbose: true }).map(move => move.to)
    : [];

  $('web-bot-board').innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const square = `${file}${rank}`;
      const row = 8 - rank;
      const col = file.charCodeAt(0) - 97;
      const symbol = board[row][col];
      const pieceColor = symbol
        ? (symbol === symbol.toUpperCase() ? 'white' : 'black')
        : '';
      const classes = [];
      if (webBotSession.lastMove &&
          (square === webBotSession.lastMove.from || square === webBotSession.lastMove.to)) {
        classes.push('bot-last-square');
      }
      if (square === webBotSelectedSquare) classes.push('bot-selected-square');
      if (legalTargets.includes(square)) classes.push('bot-legal-square');

      return `<button type="button"
                      class="${classes.join(' ')}"
                      data-bot-square="${square}"
                      data-piece-color="${pieceColor}">
                ${webPiece(symbol)}
              </button>`;
    })
  ).join('');

  $$('[data-bot-square]').forEach(button => {
    button.addEventListener('click', () => handleWebBotSquare(button.dataset.botSquare));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (!botRightMouseDown) toggleBotSquareHighlight(button.dataset.botSquare);
    });
    button.addEventListener('mousedown', event => {
      if (event.button !== 2) return;
      event.preventDefault();
      botRightMouseDown = true;
      botArrowStart = button.dataset.botSquare;
    });
    button.addEventListener('mouseup', event => {
      if (event.button !== 2 || !botArrowStart) return;
      event.preventDefault();
      const end = button.dataset.botSquare;
      if (end !== botArrowStart) addBotUserArrow(botArrowStart, end);
      botArrowStart = null;
      setTimeout(() => { botRightMouseDown = false; }, 0);
    });
  });

  paintBotUserAnnotations();
  renderWebBotMoveList();
}


function handleWebBotSquare(square) {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotSession.botThinking ||
      !webBotIsPlayerTurn()) return;

  const game = webBotSession.game;
  const piece = game.get(square);

  if (!webBotSelectedSquare) {
    if (piece && piece.color === webBotSession.playerColor) {
      webBotSelectedSquare = square;
      paintWebBotGame();
    }
    return;
  }

  if (piece && piece.color === webBotSession.playerColor) {
    webBotSelectedSquare = square;
    paintWebBotGame();
    return;
  }

  const from = webBotSelectedSquare;
  webBotSelectedSquare = null;
  const legal = game.moves({ square: from, verbose: true });
  const candidate = legal.find(move => move.to === square);

  if (!candidate) {
    paintWebBotGame();
    toast('That move is not legal.');
    return;
  }

  const currentPly = game.history().length;
  const expectedSan = webBotBookMoveAtPly(currentPly);

  if (webBotBookPhaseActive() &&
      reviewCleanSan(candidate.san) !== reviewCleanSan(expectedSan)) {
    paintWebBotGame();
    $('bot-game-message').innerHTML =
      `Stay in the selected line. The book move is <b>${escapeHtml(expectedSan)}</b>.`;
    toast(`Book move: ${expectedSan}`);
    return;
  }

  const played = game.move({
    from,
    to: square,
    promotion: candidate.promotion || 'q'
  });

  if (!played) {
    paintWebBotGame();
    toast('That move could not be played.');
    return;
  }

  webBotSession.lastMove = played;
  webBotSession.moves = game.history();
  updateWebBotPhase();
  paintWebBotGame();
  updateWebBotStatus();

  if (checkWebBotGameOver()) {
    updateWebBotEvaluation();
    return;
  }

  requestWebBotMove('player-moved');
}

function startWebBotTurnMonitor() {
  stopWebBotTurnMonitor();
  if (webBotSession?.onlineRated) return;

  webBotTurnMonitor = setInterval(() => {
    if (!webBotSession ||
        webBotSession.status !== 'active' ||
        webBotIsPlayerTurn()) return;

    requestWebBotMove('turn-monitor');
  }, 350);
}

function stopWebBotTurnMonitor() {
  if (webBotTurnMonitor) clearInterval(webBotTurnMonitor);
  webBotTurnMonitor = null;
}

function requestWebBotMove(reason = 'requested') {
  if (!webBotSession ||
      webBotSession.onlineRated ||
      webBotSession.status !== 'active' ||
      webBotIsPlayerTurn()) {
    return Promise.resolve(null);
  }

  if (webBotMovePromise) return webBotMovePromise;

  const session = webBotSession;
  session.botThinking = true;
  session.botThinkReason = reason;
  updateWebBotStatus();

  webBotMovePromise = playWebBotMove()
    .catch(error => {
      console.error('BOZO Bot move request failed:', error);
      if (webBotSession === session) {
        session.botThinking = false;
        $('bot-game-message').textContent =
          error?.message || 'BOZO Bot could not move.';
      }
      return null;
    })
    .finally(() => {
      webBotMovePromise = null;

      if (webBotSession === session &&
          session.status === 'active' &&
          !webBotIsPlayerTurn()) {
        setTimeout(() => requestWebBotMove('post-search-recovery'), 250);
      }
    });

  return webBotMovePromise;
}

function withBotTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Stockfish did not answer within ${Math.round(milliseconds / 1000)} seconds.`)),
        milliseconds
      )
    )
  ]);
}

function botMaterialValue(piece) {
  return ({ p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 })[piece] || 0;
}

function fallbackMoveSafety(game, move) {
  const clone = new Chess(game.fen());
  const played = clone.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion || 'q'
  });

  if (!played) return -100000;

  let worstReplyLoss = 0;
  const replies = clone.moves({ verbose: true });

  for (const reply of replies) {
    let loss = 0;

    if (reply.captured) {
      loss += botMaterialValue(reply.captured);
    }

    // Strongly penalize replies that capture the piece just moved.
    if (reply.to === move.to && reply.captured) {
      loss += botMaterialValue(move.piece) * 0.9;
    }

    if (reply.san.includes('#')) loss += 20000;
    else if (reply.san.includes('+')) loss += 90;

    worstReplyLoss = Math.max(worstReplyLoss, loss);
  }

  return -worstReplyLoss;
}

function chooseFallbackBotMove(game, strength) {
  const legalMoves = game.moves({ verbose: true });
  if (!legalMoves.length) return null;

  const scored = legalMoves.map(move => {
    let score = fallbackMoveSafety(game, move);

    // Immediate material gains.
    if (move.captured) score += botMaterialValue(move.captured);

    // Useful chess priorities.
    if (move.san.includes('#')) score += 50000;
    else if (move.san.includes('+')) score += 120;
    if (move.flags?.includes('k') || move.flags?.includes('q')) score += 90;
    if (move.piece === 'n' || move.piece === 'b') score += 24;
    if (['d4','d5','e4','e5','c4','c5','f4','f5'].includes(move.to)) score += 18;

    // Discourage undeveloping pieces and early queen wandering.
    const startingSquares = ['a1','b1','c1','d1','e1','f1','g1','h1',
                             'a8','b8','c8','d8','e8','f8','g8','h8'];
    if (startingSquares.includes(move.to) && !startingSquares.includes(move.from)) {
      score -= 35;
    }
    if (move.piece === 'q' && game.history().length < 16) score -= 25;

    // Only weak levels receive meaningful randomness.
    score += (strength.randomness || 0) * Math.random() * 80;

    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const choiceWindow =
    strength.depth <= 5 ? Math.min(4, scored.length) :
    strength.depth <= 7 ? Math.min(2, scored.length) :
    1;

  return scored[Math.floor(Math.random() * choiceWindow)]?.move || scored[0].move;
}

async function playWebBotMove() {
  if (!webBotSession ||
      webBotSession.status !== 'active' ||
      webBotIsPlayerTurn()) return null;

  const session = webBotSession;
  const game = session.game;
  let played = null;

  // This flag describes only the current bot move.
  session.usedFallback = false;

  try {
    const currentPly = game.history().length;
    const expectedSan = webBotBookMoveAtPly(currentPly);

    if (webBotBookPhaseActive() && expectedSan) {
      played = game.move(expectedSan, { sloppy: true });
      if (!played) throw new Error(`Invalid book move: ${expectedSan}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      updateWebBotPhase();
      $('bot-turn-badge').textContent = 'BOZO Bot thinking…';
      $('bot-game-message').textContent =
        `Stockfish is calculating at depth ${session.strength.depth}.`;

      let result = null;
      const searchTimeout = Math.max(14000, session.strength.depth * 1500);

      for (let attempt = 1; attempt <= 2 && !result; attempt++) {
        try {
          const engine = await getWebBotMoveEngine();
          result = await withBotTimeout(
            engine.analyze(game.fen(), session.strength.depth),
            searchTimeout
          );
        } catch (engineError) {
          console.warn(`BOZO Bot Stockfish attempt ${attempt} failed:`, engineError);
          resetManagedStockfish();

          if (attempt === 1) {
            $('bot-game-message').textContent =
              'Restarting Stockfish and recalculating…';
          }
        }
      }

      if (webBotSession !== session || session.status !== 'active') return null;

      let chosenUci = result?.bestMove || null;

      if (chosenUci &&
          session.strength.randomness > 0 &&
          Math.random() < session.strength.randomness) {
        const random = chooseFallbackBotMove(game, session.strength);
        if (random) {
          chosenUci = `${random.from}${random.to}${random.promotion || ''}`;
        }
      }

      if (chosenUci) {
        played = game.move({
          from: chosenUci.slice(0, 2),
          to: chosenUci.slice(2, 4),
          promotion: chosenUci.slice(4, 5) || 'q'
        });
      }

      if (!played) {
        const fallback = chooseFallbackBotMove(game, session.strength);
        if (!fallback) throw new Error('BOZO Bot has no legal move.');
        played = game.move({
          from: fallback.from,
          to: fallback.to,
          promotion: fallback.promotion || 'q'
        });
        session.usedFallback = true;
        console.warn('BOZO Bot used its emergency fallback move.');
      }
    }

    session.lastMove = played;
    session.moves = game.history();
    updateWebBotPhase();
    session.botThinking = false;
    paintWebBotGame();
    updateWebBotStatus();

    const gameEnded = checkWebBotGameOver();
    $('bot-eval-label').textContent =
      session.usedFallback ? 'Fallback' : 'Engine';
    if (gameEnded) return played;
  } catch (error) {
    console.error('BOZO Bot error:', error);
    $('bot-game-message').textContent =
      error?.message || 'BOZO Bot could not move.';
    throw error;
  } finally {
    if (webBotSession === session) {
      session.botThinking = false;
      updateWebBotStatus();
    }
  }

  return played;
}

function checkWebBotGameOver() {
  if (!webBotSession) return true;
  if (webBotSession.onlineRated) return webBotSession.status !== 'active';
  const game = webBotSession.game;
  if (!game.game_over()) return false;

  webBotSession.status = 'completed';
  stopWebBotTurnMonitor();

  if (game.in_checkmate()) {
    const loser = game.turn();
    webBotSession.resultReason =
      loser === webBotSession.playerColor
        ? 'Checkmate. BOZO Bot wins.'
        : 'Checkmate. You defeated BOZO Bot!';
  } else if (game.in_stalemate()) {
    webBotSession.resultReason = 'Draw by stalemate.';
  } else if (game.in_threefold_repetition()) {
    webBotSession.resultReason = 'Draw by threefold repetition.';
  } else if (game.insufficient_material()) {
    webBotSession.resultReason = 'Draw by insufficient material.';
  } else {
    webBotSession.resultReason = 'The game ended in a draw.';
  }

  $('bot-review-button').hidden = false;
  updateWebBotStatus();
  paintWebBotGame();
  return true;
}

function updateWebBotStatus() {
  if (!webBotSession) return;

  const session = webBotSession;
  const game = session.game;
  const playerTurn = webBotIsPlayerTurn();

  if (session.status === 'completed') {
    $('bot-turn-badge').textContent = 'Game complete';
    $('bot-phase-label').textContent = 'Finished';
    $('bot-game-message').textContent = session.resultReason;
    return;
  }

  $('bot-phase-label').textContent =
    session.onlineRated ? 'Rated online' :
    session.phase === 'book' ? 'Book phase' : 'Free play';

  // Online games are player-vs-player. Never show BOZO Bot, Stockfish,
  // book-training, or opening-lesson status text in this mode.
  if (session.onlineRated) {
    $('bot-turn-badge').textContent = playerTurn ? 'Your move' : 'Opponent to move';
    $('bot-game-message').textContent = playerTurn
      ? 'Your move.'
      : 'Waiting for your opponent to move.';
    return;
  }

  if (session.botThinking) {
    $('bot-turn-badge').textContent = 'BOZO Bot thinking…';
    $('bot-game-message').textContent =
      session.phase === 'book'
        ? 'BOZO Bot is following the selected line.'
        : `Stockfish is thinking at depth ${session.strength.depth}.`;
    return;
  }

  $('bot-turn-badge').textContent = playerTurn ? 'Your move' : 'BOZO Bot';
  if (playerTurn) {
    const expected = webBotBookPhaseActive()
      ? webBotBookMoveAtPly(game.history().length)
      : null;
    $('bot-game-message').innerHTML = expected
      ? `Play the selected book move. <span class="bot-hidden-hint">Hint available after an incorrect attempt.</span>`
      : 'Any legal move is allowed. The opening lesson is complete.';
  } else {
    $('bot-game-message').textContent =
      session.phase === 'book'
        ? 'BOZO Bot will answer with the stored book move.'
        : session.usedFallback
          ? 'The last move used the emergency safety fallback.'
          : 'BOZO Bot will choose a Stockfish move.';

    // Recovery is handled by the permanent turn monitor.
  }
}
function renderWebBotMoveList() {
  if (!webBotSession) return;
  $('bot-move-list').innerHTML = renderDuelMoveRows(webBotSession.game.history());
}

async function updateWebBotEvaluation() {
  if (!webBotSession) return;
  $('bot-eval-white').style.width = '50%';
  $('bot-eval-label').textContent =
    webBotSession.botThinking ? 'Thinking' : 'Paused';
}

async function resignWebBotGame() {
  if(ratedMatchSession?.status==='active'){
    try{const {data,error}=await sb.functions.invoke('rated-match',{body:{action:'resign',matchId:ratedMatchSession.id}});if(error)throw error;if(data?.error)throw new Error(data.error);await refreshRatedMatchFromServer();return;}catch(error){toast(error?.message||'Could not resign this online game.');return;}
  }
  if(!webBotSession||webBotSession.status!=='active')return;
  webBotSession.status='completed';stopWebBotTurnMonitor();webBotSession.resultReason='You resigned. BOZO Bot wins.';$('bot-review-button').hidden=false;updateWebBotStatus();
}

function restartWebBotGame() {
  if (!webBotSession) return;
  const setup = {
    opening: webBotSession.opening,
    bookSans: webBotSession.bookSans,
    requiredBookPlies: webBotSession.requiredBookPlies,
    playerColor: webBotSession.playerColor,
    strengthKey: webBotSession.strengthKey,
    strength: webBotSession.strength,
    freePlay: Boolean(webBotSession.freePlay)
  };

  webBotSession = {
    ...setup,
    game: new Chess(),
    phase: setup.freePlay ? 'freeplay' : 'book',
    status: 'active',
    resultReason: '',
    moves: [],
    selected: null,
    lastMove: null,
    botThinking: false,
    startedAt: Date.now()
  };

  webBotSelectedSquare = null;
  botUserArrows = [];
  $('bot-review-button').hidden = true;
  resetManagedStockfish();
  paintWebBotGame();
  updateWebBotStatus();
  startWebBotTurnMonitor();
  $('bot-eval-label').textContent = 'Paused';
  $('bot-eval-white').style.width = '50%';

  if (!webBotIsPlayerTurn()) requestWebBotMove('restart');
}

function reviewWebBotGame() {
  const game=ratedMatchSession?.game||webBotSession?.game;
  if(!game)return;
  const wasRated=Boolean(ratedMatchSession);
  const pgn=game.pgn();
  closeCompletedPlayOverlays();
  route('review');
  setTimeout(()=>{
    $('review-pgn-input').value=pgn;
    $('review-import-message').textContent=wasRated
      ?'Rated online game loaded. Choose the analysis settings and click Analyze game.'
      :'BOZO Bot game loaded. Choose the analysis settings and click Analyze game.';
    $('review-pgn-input').scrollIntoView({behavior:'smooth',block:'center'});
  },100);
}

$('close-bot-game').addEventListener('click', closeWebBotGame);
$('bot-resign-button').addEventListener('click', resignWebBotGame);
$('rated-offer-draw-button')?.addEventListener('click', offerRatedDraw);
$('rated-accept-draw')?.addEventListener('click', () => respondRatedDraw(true));
$('rated-decline-draw')?.addEventListener('click', () => respondRatedDraw(false));
$('rated-rematch-button')?.addEventListener('click', requestRatedRematch);
$('rated-accept-rematch')?.addEventListener('click', () => respondRatedRematch(true));
$('rated-decline-rematch')?.addEventListener('click', () => respondRatedRematch(false));

$('bot-restart-button').addEventListener('click', restartWebBotGame);
$('bot-review-button').addEventListener('click', reviewWebBotGame);
$('clear-bot-arrows').addEventListener('click', () => {
  botUserArrows = [];
  paintBotUserAnnotations();
});
$('duel-clear-marks')?.addEventListener('click', () => { duelUserAnnotations = []; paintDuelAnnotations(); });

function botSquareCenter(square) {
  const activeColor = ratedMatchSession?.myColor || webBotSession?.playerColor || 'w';
  const orientation = activeColor === 'b' ? 'black' : 'white';
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  return {
    x: (orientation === 'white' ? fileIndex : 7 - fileIndex) * 100 + 50,
    y: (orientation === 'white' ? 7 - rankIndex : rankIndex) * 100 + 50
  };
}

function addBotUserArrow(from, to) {
  const existing = botUserArrows.findIndex(item =>
    item.type === 'arrow' && item.from === from && item.to === to
  );
  if (existing >= 0) botUserArrows.splice(existing, 1);
  else botUserArrows.push({ type: 'arrow', from, to });
  paintBotUserAnnotations();
}

function toggleBotSquareHighlight(square) {
  const existing = botUserArrows.findIndex(item =>
    item.type === 'square' && item.square === square
  );
  if (existing >= 0) botUserArrows.splice(existing, 1);
  else botUserArrows.push({ type: 'square', square });
  paintBotUserAnnotations();
}

function paintBotUserAnnotations() {
  const svg = $('bot-user-arrow-layer');
  if (!svg || (!webBotSession && !ratedMatchSession)) return;

  const marker = `
    <marker id="bot-user-arrow-head"
            markerWidth="8" markerHeight="8"
            refX="6.5" refY="4"
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="#f6c945"></path>
    </marker>`;

  const markup = botUserArrows.map(item => {
    if (item.type === 'square') {
      const center = botSquareCenter(item.square);
      return `<rect x="${center.x - 48}" y="${center.y - 48}"
                    width="96" height="96" rx="10"
                    fill="#f6c945" opacity=".28"></rect>`;
    }

    const from = botSquareCenter(item.from);
    const to = botSquareCenter(item.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const endX = to.x - dx / length * 23;
    const endY = to.y - dy / length * 23;

    return `<line x1="${from.x}" y1="${from.y}"
                  x2="${endX}" y2="${endY}"
                  stroke="#f6c945"
                  stroke-width="14"
                  stroke-linecap="round"
                  opacity=".80"
                  marker-end="url(#bot-user-arrow-head)"></line>`;
  }).join('');

  svg.innerHTML = `<defs>${marker}</defs>${markup}`;
}

let challengeFilter = 'active';
let webChallengeRows = [];
let activeWebDuel = null;
let webDuelGame = null;
let selectedWebSquare = null;
let duelRealtimeChannel = null;
let duelPollingTimer = null;
let duelRefreshInFlight = false;
let duelLastSignature = '';
let duelUserAnnotations = [];
let duelArrowStart = null;
let duelRightMouseDown = false;
let duelClockTimer = null;
let duelClockSnapshot = null;

function renderChallenges() {
  const signedIn = Boolean(state.session?.user);
  $('challenges-guest').hidden = signedIn;
  $('challenges-user').hidden = !signedIn;
  if (signedIn) loadChallenges();
}

$$('[data-challenge-filter]').forEach(button => {
  button.addEventListener('click', () => {
    challengeFilter = button.dataset.challengeFilter;
    $$('[data-challenge-filter]').forEach(b => b.classList.toggle('active', b === button));
    paintChallengeList();
  });
});

let newGameMode = 'friend';

function openNewGameSetup(mode = 'friend') {
  newGameMode = mode;
  $('challenge-create-modal').hidden = false;
  $('duel-opening-results').innerHTML = '';
  $('duel-opening-id').value = '';
  $('duel-create-status').textContent = '';
  $$('[data-new-game-mode]').forEach(button =>
    button.classList.toggle('active', button.dataset.newGameMode === mode)
  );
  $('friend-game-fields').hidden = mode !== 'friend';
  $('bot-game-fields').hidden = mode !== 'bot';
  $('send-opening-duel').textContent =
    mode === 'bot' ? 'Start training game' : 'Send challenge';
}

$('manage-ratings-button')?.addEventListener('click', () => openRatingSetup(selectedMatchmakingPool()));
document.addEventListener('click', event => {
  const modal = $('rating-setup-modal');
  if (!modal || modal.hidden) return;

  const closeButton = event.target.closest?.('#close-rating-setup');
  if (closeButton) {
    event.preventDefault();
    closeRatingSetup();
    return;
  }

  const tierButton = event.target.closest?.('[data-rating-tier]');
  if (tierButton && modal.contains(tierButton)) {
    event.preventDefault();
    initializeBozoRating(tierButton.dataset.ratingTier);
    return;
  }

  if (event.target === modal) closeRatingSetup();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('rating-setup-modal')?.hidden) closeRatingSetup();
});

$('matchmaking-pool')?.addEventListener('change', syncTimeToMatchmakingPool);
$('matchmaking-time')?.addEventListener('change', syncPoolToMatchmakingTime);
$('find-opponent-button')?.addEventListener('click', enterMatchmakingQueue);
$('cancel-matchmaking-button')?.addEventListener('click', leaveMatchmakingQueue);
$('play-rating-grid')?.addEventListener('click', event => {
  const chip = event.target.closest('[data-rating-pool]');
  if (!chip) return;
  const pool = chip.dataset.ratingPool;
  if (!ratingRow(pool)) openRatingSetup(pool);
});

$('start-freeplay-bot')?.addEventListener('click', startBozoFreePlay);
$('play-friend-existing')?.addEventListener('click', () => route('challenges'));

$('new-challenge-button').addEventListener('click', () => openNewGameSetup('friend'));
$('new-bot-game-button').addEventListener('click', () => openNewGameSetup('bot'));

$$('[data-new-game-mode]').forEach(button => {
  button.addEventListener('click', () => openNewGameSetup(button.dataset.newGameMode));
});

$('close-challenge-create').addEventListener('click', () => $('challenge-create-modal').hidden = true);
$('close-challenge-game').addEventListener('click', closeWebDuel);
$('duel-refresh-button').addEventListener('click', async () => {
  if (!activeWebDuel?.id) return;
  const changed = await refreshOpenWebDuel(activeWebDuel.id, { force: true });
  toast(changed ? 'Board refreshed' : 'Board is already current');
});
$('duel-offer-draw-button')?.addEventListener('click', offerWebDuelDraw);
$('duel-accept-draw')?.addEventListener('click', () => respondWebDuelDraw(true));
$('duel-decline-draw')?.addEventListener('click', () => respondWebDuelDraw(false));
$('duel-resign-button').addEventListener('click', resignWebDuel);

let openingSearchTimer;
$('duel-opening-search').addEventListener('input', () => {
  clearTimeout(openingSearchTimer);
  openingSearchTimer = setTimeout(searchDuelOpenings, 260);
});
$('send-opening-duel').addEventListener('click', () => {
  if (newGameMode === 'bot') startWebBotGameFromSetup();
  else sendWebChallenge();
});

async function searchDuelOpenings() {
  const query = $('duel-opening-search').value.trim();
  if (query.length < 2) return $('duel-opening-results').innerHTML = '';
  const { data, error } = await sb.from('openings')
    .select('id,eco,name,variation,pgn')
    .eq('status','published')
    .or(`name.ilike.%${query}%,variation.ilike.%${query}%,eco.ilike.%${query}%`)
    .order('name').limit(20);
  if (error) return $('duel-opening-results').textContent = readableError(error);
  $('duel-opening-results').innerHTML = (data || []).map(o => `
    <button data-duel-opening-id="${o.id}">
      <b>${escapeHtml(o.name)}</b>
      <span>${escapeHtml(o.variation || 'Main Line')} · ${escapeHtml(o.eco || 'ECO  - ')}</span>
      <code>${escapeHtml((o.pgn || '').slice(0,120))}</code>
    </button>`).join('');
  $('duel-opening-results').querySelectorAll('button').forEach((button, i) => {
    button.addEventListener('click', () => {
      const opening = data[i];
      $('duel-opening-id').value = opening.id;
      $('duel-opening-search').value = `${opening.name}${opening.variation ? ': ' + opening.variation : ''}`;
      $('duel-opening-results').innerHTML = '';
    });
  });
}

async function sendWebChallenge() {
  const openingId = $('duel-opening-id').value;
  const opponent = $('duel-opponent').value.trim();
  if (!opponent || !openingId) {
    $('duel-create-status').textContent = 'Choose an opponent and a cloud opening line.';
    return;
  }
  $('duel-create-status').textContent = 'Sending…';
  const { error } = await sb.rpc('create_opening_challenge', {
    opponent_username: opponent,
    selected_opening_id: openingId,
    selected_color: $('duel-color').value,
    selected_required_plies: Number($('duel-required-plies').value),
    selected_time_control: 'correspondence'
  });
  if (error) return $('duel-create-status').textContent = readableError(error);
  $('challenge-create-modal').hidden = true;
  toast('Opening Duel sent');
  challengeFilter = 'sent';
  await loadChallenges();
}

async function loadChallenges() {
  const { data, error } = await sb.rpc('my_opening_challenges');
  if (error) {
    $('web-challenge-list').innerHTML = `<div class="empty-state"><b>${escapeHtml(readableError(error))}</b></div>`;
    return;
  }
  webChallengeRows = data || [];
  paintChallengeList();
}

function challengeOpponentName(c) {
  const me = state.session.user.id;
  return c.challenger_id === me
    ? `${c.opponent_ign} (@${c.opponent_username})`
    : `${c.challenger_ign} (@${c.challenger_username})`;
}

function challengeColor(c) {
  const me = state.session.user.id;
  const challengerIsWhite = c.challenger_color === 'white';
  const iAmChallenger = c.challenger_id === me;
  return (challengerIsWhite === iAmChallenger) ? 'White' : 'Black';
}

function filteredChallenges() {
  const uid = state.session.user.id;
  return webChallengeRows.filter(c => {
    if (challengeFilter === 'active') return c.status === 'active';
    if (challengeFilter === 'incoming') return c.status === 'pending' && c.opponent_id === uid;
    if (challengeFilter === 'sent') return c.status === 'pending' && c.challenger_id === uid;
    return ['completed','declined','cancelled'].includes(c.status);
  });
}

function paintChallengeList() {
  const rows = filteredChallenges();
  const target = $('web-challenge-list');
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state"><div>⚔</div><b>No ${challengeFilter} duels</b><span>Challenge someone to an exact opening or sideline.</span></div>`;
    return;
  }
  target.innerHTML = rows.map(c => {
    const incoming = c.status === 'pending' && c.opponent_id === state.session.user.id;
    const sent = c.status === 'pending' && c.challenger_id === state.session.user.id;
    const active = c.status === 'active';
    const moveCount = (c.move_history || []).length;
    return `<article class="web-duel-card">
      <div class="web-duel-card-head">
        <div><span>${escapeHtml(c.variation_name || 'Main Line')}</span><h3>${escapeHtml(c.opening_name)}</h3></div>
        <div class="duel-status ${c.status}">${escapeHtml(c.status)}</div>
      </div>
      <p>vs ${escapeHtml(challengeOpponentName(c))} · You play ${challengeColor(c)}</p>
      <div class="duel-progress"><i style="width:${Math.min(100,(moveCount/c.required_plies)*100)}%"></i></div>
      <small>${moveCount}/${c.required_plies} required book plies completed</small>
      <div class="duel-card-actions">
        ${incoming ? `<button class="button primary" onclick="respondWebChallenge('${c.id}',true)">Accept</button><button class="button secondary" onclick="respondWebChallenge('${c.id}',false)">Decline</button>` : ''}
        ${sent ? `<button class="button secondary" onclick="cancelWebChallenge('${c.id}')">Cancel</button>` : ''}
        ${active ? `<button class="button primary" onclick="openWebDuel('${c.id}')">Open board</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

async function respondWebChallenge(id, accept) {
  const { error } = await sb.rpc('respond_opening_challenge',{challenge_id:id,accept_challenge:accept});
  if (error) return toast(readableError(error));
  toast(accept ? 'Challenge accepted' : 'Challenge declined');
  await loadChallenges();
}
async function cancelWebChallenge(id) {
  const { error } = await sb.rpc('cancel_opening_challenge',{challenge_id:id});
  if (error) return toast(readableError(error));
  toast('Challenge cancelled');
  await loadChallenges();
}

async function fetchWebDuel(id) {
  if (duelRefreshInFlight) return null;
  duelRefreshInFlight = true;

  try {
    const { data, error } = await sb.rpc('my_opening_challenges');
    if (error) throw error;

    const duel = (data || []).find(challenge => challenge.id === id) || null;
    if (!duel) return null;

    // Clock columns were added after the original challenge RPC. Read them
    // directly and merge them without changing the existing RPC contract.
    const { data: clockRow, error: clockError } = await sb
      .from('opening_challenges')
      .select('white_time_ms,black_time_ms,clock_started_at,draw_offer_by,draw_offer_at,updated_at')
      .eq('id', id)
      .maybeSingle();

    if (!clockError && clockRow) Object.assign(duel, clockRow);
    return duel;
  } finally {
    duelRefreshInFlight = false;
  }
}

function replayWebDuelPosition(duel) {
  const game = new Chess();
  const moves = normalizeDuelMoveHistory(duel?.move_history);

  for (const san of moves) {
    const result = game.move(san, { sloppy: true });
    if (!result) {
      console.warn('Could not replay duel move:', san);
      break;
    }
  }

  return game;
}

async function refreshOpenWebDuel(id, { force = false } = {}) {
  const duel = await fetchWebDuel(id);
  if (!duel) {
    if (force) toast('Duel not found');
    return false;
  }

  const signature = duelStateSignature(duel);
  if (!force && signature === duelLastSignature) return false;

  activeWebDuel = duel;
  webDuelGame = replayWebDuelPosition(duel);
  duelLastSignature = signature;
  selectedWebSquare = null;

  $('duel-game-title').textContent = duel.opening_name;
  $('duel-game-subtitle').textContent =
    `${duel.variation_name || 'Main Line'} · vs ${challengeOpponentName(duel)}`;
  $('duel-book-name').textContent = duel.variation_name || 'Main Line';
  $('duel-book-pgn').textContent = duel.line_pgn || '';

  paintWebDuel();
  checkAndFinishWebDuelRules().catch(error =>
    console.warn('Automatic draw check failed:', error)
  );
  return true;
}

function startWebDuelPolling(id) {
  stopWebDuelPolling();

  duelPollingTimer = setInterval(() => {
    if ($('challenge-game-modal').hidden) return;
    refreshOpenWebDuel(id).catch(error =>
      console.warn('Duel polling refresh failed:', error)
    );
  }, 1200);
}

function stopWebDuelPolling() {
  if (duelPollingTimer) clearInterval(duelPollingTimer);
  duelPollingTimer = null;
}

async function openWebDuel(id) {
  $('challenge-game-modal').hidden = false;

  const loaded = await refreshOpenWebDuel(id, { force: true });
  if (!loaded) {
    $('challenge-game-modal').hidden = true;
    return;
  }

  if (duelRealtimeChannel) {
    sb.removeChannel(duelRealtimeChannel);
    duelRealtimeChannel = null;
  }

  duelRealtimeChannel = sb.channel(`duel-${id}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'opening_challenges',
        filter: `id=eq.${id}`
      },
      () => {
        refreshOpenWebDuel(id, { force: true }).catch(error =>
          console.warn('Realtime duel refresh failed:', error)
        );
      }
    )
    .subscribe(status => {
      console.info('Duel realtime status:', status);
    });

  startWebDuelPolling(id);
  startDuelClock();
}

function closeWebDuel() {
  $('challenge-game-modal').hidden = true;
  stopWebDuelPolling();
  stopDuelClock();
  duelLastSignature = '';
  duelUserAnnotations = [];
  duelArrowStart = null;

  if (duelRealtimeChannel) {
    sb.removeChannel(duelRealtimeChannel);
    duelRealtimeChannel = null;
  }
}

function duelSquareCenter(square) {
  const orientation = activeWebDuel ? myDuelColor(activeWebDuel) : 'white';
  const fileIndex = square.charCodeAt(0) - 97;
  const rankIndex = Number(square[1]) - 1;
  const displayFile = orientation === 'white' ? fileIndex : 7 - fileIndex;
  const displayRank = orientation === 'white' ? 7 - rankIndex : rankIndex;
  return {
    x: displayFile * 100 + 50,
    y: displayRank * 100 + 50
  };
}

function addDuelArrow(from, to) {
  const index = duelUserAnnotations.findIndex(item =>
    item.type === 'arrow' && item.from === from && item.to === to
  );
  if (index >= 0) duelUserAnnotations.splice(index, 1);
  else duelUserAnnotations.push({ type: 'arrow', from, to });
  paintDuelAnnotations();
}

function toggleDuelSquare(square) {
  const index = duelUserAnnotations.findIndex(item =>
    item.type === 'square' && item.square === square
  );
  if (index >= 0) duelUserAnnotations.splice(index, 1);
  else duelUserAnnotations.push({ type: 'square', square });
  paintDuelAnnotations();
}

function paintDuelAnnotations() {
  const svg = $('friend-duel-arrow-layer');
  if (!svg || !activeWebDuel) return;

  const marker = `
    <marker id="friend-duel-arrow-head"
            markerWidth="8" markerHeight="8"
            refX="6.5" refY="4"
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,4 L0,8 Z" fill="#f6c945"></path>
    </marker>`;

  const markup = duelUserAnnotations.map(item => {
    if (item.type === 'square') {
      const center = duelSquareCenter(item.square);
      return `<rect x="${center.x - 48}" y="${center.y - 48}"
                    width="96" height="96" rx="10"
                    fill="#f6c945" opacity=".28"></rect>`;
    }

    const from = duelSquareCenter(item.from);
    const to = duelSquareCenter(item.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const endX = to.x - dx / length * 23;
    const endY = to.y - dy / length * 23;

    return `<line x1="${from.x}" y1="${from.y}"
                  x2="${endX}" y2="${endY}"
                  stroke="#f6c945"
                  stroke-width="14"
                  stroke-linecap="round"
                  opacity=".80"
                  marker-end="url(#friend-duel-arrow-head)"></line>`;
  }).join('');

  svg.innerHTML = `<defs>${marker}</defs>${markup}`;
}

function chessBoolean(game, names) {
  for (const name of names) {
    if (typeof game?.[name] === 'function') {
      try {
        if (game[name]()) return true;
      } catch (_) {}
    }
  }
  return false;
}

function duelThreefold(game) {
  return chessBoolean(game, [
    'isThreefoldRepetition',
    'inThreefoldRepetition',
    'in_threefold_repetition'
  ]);
}

function duelStalemate(game) {
  return chessBoolean(game, ['isStalemate', 'inStalemate', 'in_stalemate']);
}

function duelInsufficientMaterial(game) {
  return chessBoolean(game, [
    'isInsufficientMaterial',
    'insufficientMaterial',
    'insufficient_material'
  ]);
}

function duelGeneralDraw(game) {
  return chessBoolean(game, ['isDraw', 'inDraw', 'in_draw']);
}

function duelCheckmate(game) {
  return chessBoolean(game, ['isCheckmate', 'inCheckmate', 'in_checkmate']);
}

function duelHalfmoveClock(game) {
  const fen = game?.fen?.() || '';
  const fields = fen.split(' ');
  return Number(fields[4] || 0);
}

function duelFiftyMoveRule(game) {
  return duelHalfmoveClock(game) >= 100;
}

function duelAutomaticDrawReason(game) {
  if (duelThreefold(game)) return 'threefold repetition';
  if (duelFiftyMoveRule(game)) return 'fifty-move rule';
  if (duelStalemate(game)) return 'stalemate';
  if (duelInsufficientMaterial(game)) return 'insufficient material';

  // Some chess.js versions expose only a combined draw method.
  if (duelGeneralDraw(game) && !duelCheckmate(game)) return 'draw';
  return '';
}

function sideHasPossibleMatingMaterial(game, color) {
  const pieces = [];
  for (const file of ['a','b','c','d','e','f','g','h']) {
    for (let rank = 1; rank <= 8; rank++) {
      const piece = game.get(`${file}${rank}`);
      if (piece?.color === color && piece.type !== 'k') pieces.push(piece.type);
    }
  }

  if (pieces.some(type => type === 'q' || type === 'r' || type === 'p')) return true;
  const bishops = pieces.filter(type => type === 'b').length;
  const knights = pieces.filter(type => type === 'n').length;

  // This is intentionally conservative: combinations that can possibly
  // produce mate count as mating material.
  return bishops >= 2 || (bishops >= 1 && knights >= 1) || knights >= 2;
}

async function finishWebDuelAsDraw(reason) {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return false;

  const { error } = await sb.rpc('finish_opening_challenge', {
    challenge_id: activeWebDuel.id,
    finish_reason: reason,
    game_result: '1/2-1/2'
  });

  if (error) {
    console.warn('Could not finish duel as draw:', error);
    return false;
  }

  activeWebDuel.status = 'completed';
  activeWebDuel.result = '1/2-1/2';
  activeWebDuel.draw_offer_by = null;
  activeWebDuel.draw_offer_at = null;
  stopDuelClock();
  paintWebDuel();
  toast(`Draw by ${reason}`);
  return true;
}

async function checkAndFinishWebDuelRules() {
  if (!activeWebDuel || activeWebDuel.status !== 'active' || !webDuelGame) return false;

  if (duelCheckmate(webDuelGame)) {
    const result = webDuelGame.turn() === 'w' ? '0-1' : '1-0';
    const { error } = await sb.rpc('finish_opening_challenge', {
      challenge_id: activeWebDuel.id,
      finish_reason: 'checkmate',
      game_result: result
    });
    if (!error) {
      activeWebDuel.status = 'completed';
      activeWebDuel.result = result;
      stopDuelClock();
      paintWebDuel();
      return true;
    }
    return false;
  }

  const drawReason = duelAutomaticDrawReason(webDuelGame);
  if (drawReason) return finishWebDuelAsDraw(drawReason);
  return false;
}

function paintDuelDrawOffer() {
  const panel = $('duel-draw-offer-panel');
  const offerButton = $('duel-offer-draw-button');
  if (!panel || !offerButton || !activeWebDuel) return;

  const uid = state.session?.user?.id;
  const offeredByMe = activeWebDuel.draw_offer_by === uid;
  const offeredByOpponent =
    Boolean(activeWebDuel.draw_offer_by) && activeWebDuel.draw_offer_by !== uid;

  panel.hidden = !activeWebDuel.draw_offer_by || activeWebDuel.status !== 'active';
  offerButton.disabled =
    activeWebDuel.status !== 'active' || Boolean(activeWebDuel.draw_offer_by);
  offerButton.textContent = offeredByMe ? 'Draw offered' : 'Offer draw';

  if (offeredByMe) {
    $('duel-draw-offer-title').textContent = 'Draw offer sent';
    $('duel-draw-offer-message').textContent =
      'Waiting for your opponent to accept or decline.';
    $('duel-draw-response-actions').hidden = true;
  } else if (offeredByOpponent) {
    $('duel-draw-offer-title').textContent = 'Your opponent offers a draw';
    $('duel-draw-offer-message').textContent =
      'Accept to finish the game as a draw, or decline to continue.';
    $('duel-draw-response-actions').hidden = false;
  }
}

async function offerWebDuelDraw() {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return;
  const button = $('duel-offer-draw-button');
  button.disabled = true;

  const { data, error } = await sb.rpc('offer_opening_challenge_draw', {
    challenge_id: activeWebDuel.id
  });

  if (error) {
    button.disabled = false;
    return toast(readableError(error));
  }

  if (data) Object.assign(activeWebDuel, data);
  else {
    activeWebDuel.draw_offer_by = state.session.user.id;
    activeWebDuel.draw_offer_at = new Date().toISOString();
  }
  paintDuelDrawOffer();
  toast('Draw offered');
}

async function respondWebDuelDraw(accept) {
  if (!activeWebDuel || !activeWebDuel.draw_offer_by) return;

  const { data, error } = await sb.rpc('respond_opening_challenge_draw', {
    challenge_id: activeWebDuel.id,
    accept_draw: Boolean(accept)
  });

  if (error) return toast(readableError(error));

  if (accept) {
    if (data) Object.assign(activeWebDuel, data);
    activeWebDuel.status = 'completed';
    activeWebDuel.result = '1/2-1/2';
    stopDuelClock();
    paintWebDuel();
    toast('Draw agreed');
  } else {
    activeWebDuel.draw_offer_by = null;
    activeWebDuel.draw_offer_at = null;
    paintDuelDrawOffer();
    toast('Draw offer declined');
  }
}

function formatDuelClock(milliseconds) {
  const safe = Math.max(0, Number(milliseconds || 0));
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function duelColorForUser(duel, userId) {
  const challengerIsWhite = duel.challenger_color === 'white';
  if (userId === duel.challenger_id) return challengerIsWhite ? 'white' : 'black';
  if (userId === duel.opponent_id) return challengerIsWhite ? 'black' : 'white';
  return null;
}

function currentDuelClockValues() {
  if (!activeWebDuel) return { white: 600000, black: 600000 };

  let white = Number(activeWebDuel.white_time_ms ?? 600000);
  let black = Number(activeWebDuel.black_time_ms ?? 600000);

  if (activeWebDuel.status === 'active' &&
      activeWebDuel.clock_started_at &&
      activeWebDuel.turn_user_id) {
    const elapsed = Math.max(
      0,
      Date.now() - new Date(activeWebDuel.clock_started_at).getTime()
    );
    const activeColor = duelColorForUser(activeWebDuel, activeWebDuel.turn_user_id);
    if (activeColor === 'white') white -= elapsed;
    if (activeColor === 'black') black -= elapsed;
  }

  return { white: Math.max(0, white), black: Math.max(0, black) };
}

function paintDuelClock() {
  const panel = $('friend-duel-clocks');
  if (!panel || !activeWebDuel) return;

  panel.hidden = false;
  const values = currentDuelClockValues();
  $('friend-clock-white').textContent = formatDuelClock(values.white);
  $('friend-clock-black').textContent = formatDuelClock(values.black);

  const whiteUser = activeWebDuel.challenger_color === 'white'
    ? activeWebDuel.challenger_username
    : activeWebDuel.opponent_username;
  const blackUser = activeWebDuel.challenger_color === 'white'
    ? activeWebDuel.opponent_username
    : activeWebDuel.challenger_username;

  $('friend-clock-white-name').textContent = `White · ${whiteUser || ''}`;
  $('friend-clock-black-name').textContent = `Black · ${blackUser || ''}`;

  const activeColor = activeWebDuel.status === 'active'
    ? duelColorForUser(activeWebDuel, activeWebDuel.turn_user_id)
    : null;

  panel.querySelector('[data-color="white"]')
    ?.classList.toggle('active', activeColor === 'white');
  panel.querySelector('[data-color="black"]')
    ?.classList.toggle('active', activeColor === 'black');

  if ((values.white <= 0 || values.black <= 0) &&
      activeWebDuel.status === 'active') {
    const flaggingColor = values.white <= 0 ? 'white' : 'black';
    const winnerColor = flaggingColor === 'white' ? 'black' : 'white';
    const winnerChessColor = winnerColor === 'white' ? 'w' : 'b';

    $('duel-game-message').textContent =
      `${flaggingColor[0].toUpperCase() + flaggingColor.slice(1)} has run out of time.`;

    stopDuelClock();

    if (!sideHasPossibleMatingMaterial(webDuelGame, winnerChessColor)) {
      finishWebDuelAsDraw('timeout against insufficient mating material');
    } else {
      const result = winnerColor === 'white' ? '1-0' : '0-1';
      sb.rpc('finish_opening_challenge', {
        challenge_id: activeWebDuel.id,
        finish_reason: 'timeout',
        game_result: result
      }).then(({ error }) => {
        if (error) return console.warn('Could not finish timeout:', error);
        activeWebDuel.status = 'completed';
        activeWebDuel.result = result;
        paintWebDuel();
      });
    }
  }
}

function startDuelClock() {
  stopDuelClock();
  paintDuelClock();
  duelClockTimer = setInterval(paintDuelClock, 250);
}

function stopDuelClock() {
  if (duelClockTimer) clearInterval(duelClockTimer);
  duelClockTimer = null;
}

function webPiece(symbol) {
  const normalize = {
    P:'wP', R:'wR', N:'wN', B:'wB', Q:'wQ', K:'wK',
    p:'bP', r:'bR', n:'bN', b:'bB', q:'bQ', k:'bK',
    '♙':'wP', '♖':'wR', '♘':'wN', '♗':'wB', '♕':'wQ', '♔':'wK',
    '♟':'bP', '♜':'bR', '♞':'bN', '♝':'bB', '♛':'bQ', '♚':'bK',
    wP:'wP', wR:'wR', wN:'wN', wB:'wB', wQ:'wQ', wK:'wK',
    bP:'bP', bR:'bR', bN:'bN', bB:'bB', bQ:'bQ', bK:'bK'
  };

  const id = normalize[symbol];
  if (!id) return '';

  const color = id[0] === 'w' ? 'white' : 'black';
  const source = `./assets/pieces/bozo-universal/${id}.png?v=3.2.2`;

  return `<img
    class="bozo-chess-piece bozo-chess-piece-${color}"
    src="${source}"
    alt=""
    draggable="false"
    decoding="async"
    aria-hidden="true">`;
}

function fenBoard(fen) {
  const normalizedFen =
    !fen || fen === 'start' || fen === 'startpos'
      ? new Chess().fen()
      : fen;
  const boardPart = normalizedFen.split(' ')[0];
  return boardPart.split('/').map(rank => {
    const squares=[];
    for (const ch of rank) {
      if (/\d/.test(ch)) for(let i=0;i<Number(ch);i++) squares.push('');
      else squares.push(ch);
    }
    return squares;
  });
}


// BOZO v4.14.12: dedicated static Master Explorer.
const BOZO_MASTER_EXPLORER_BASE = './explorer-data';
const bozoMasterExplorerShardCache = new Map();
let bozoMasterExplorerGame = null;
let bozoMasterExplorerOrientation = 'white';
let bozoMasterExplorerRequest = 0;
let bozoMasterExplorerBaseFen = null;
let bozoMasterExplorerMinGames = 1;

function bozoMasterExplorerFenKey(fen='') {
  const fullFen = String(fen || '').trim();
  const parts = fullFen.split(/\s+/);
  if (parts.length < 4) return parts.slice(0,4).join(' ');

  // Match python-chess's legal-en-passant FEN normalization used by
  // the master database. chess.js keeps the raw EP target square after
  // every double pawn push (for example e3 after 1.e4), even if no legal
  // en-passant capture exists.
  if (parts[3] !== '-') {
    try {
      const probe = new Chess(fullFen);
      const hasLegalEnPassant = probe.moves({ verbose: true }).some(move => {
        if (typeof move?.isEnPassant === 'function' && move.isEnPassant()) return true;
        return String(move?.flags || '').includes('e');
      });
      if (!hasLegalEnPassant) parts[3] = '-';
    } catch (error) {
      console.warn('Master Explorer FEN normalization fallback:', error);
    }
  }

  return parts.slice(0,4).join(' ');
}

async function bozoMasterExplorerShardName(fenKey) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fenKey)));
  return digest[0].toString(16).padStart(2,'0');
}

async function bozoMasterExplorerDecode(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('Gzip decompression is not supported in this browser.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return new TextDecoder().decode(bytes);
}

async function bozoMasterExplorerLoadShard(name) {
  if (bozoMasterExplorerShardCache.has(name)) return bozoMasterExplorerShardCache.get(name);
  const promise = (async()=>{
    const response = await fetch(`${BOZO_MASTER_EXPLORER_BASE}/${name}.ndjson.gz`, {cache:'force-cache'});
    if (!response.ok) throw new Error(`Shard ${name} returned ${response.status}`);
    const text = await bozoMasterExplorerDecode(response);
    const positions = new Map();
    for (const line of text.split('\n')) {
      if (!line) continue;
      const row = JSON.parse(line);
      positions.set(row.f,row.m);
    }
    return positions;
  })();
  bozoMasterExplorerShardCache.set(name,promise);
  try { return await promise; }
  catch (error) { bozoMasterExplorerShardCache.delete(name); throw error; }
}

function bozoMasterExplorerPaintBoard() {
  const target = $('master-explorer-board');
  if (!target || !bozoMasterExplorerGame) return;
  const board = fenBoard(bozoMasterExplorerGame.fen());
  const ranks = bozoMasterExplorerOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = bozoMasterExplorerOrientation === 'white' ? [...'abcdefgh'] : [...'hgfedcba'];
  target.innerHTML = ranks.flatMap(rank => files.map(file => {
    const row = 8-rank, col = file.charCodeAt(0)-97;
    const light = ((file.charCodeAt(0)-97) + rank) % 2 === 1;
    const showFile = rank === (bozoMasterExplorerOrientation === 'white' ? 1 : 8);
    const showRank = file === (bozoMasterExplorerOrientation === 'white' ? 'a' : 'h');
    return `<div class="master-explorer-square ${light?'light':'dark'}">
      ${webPiece(board[row][col])}
      ${showFile?`<span class="master-explorer-file">${file}</span>`:''}
      ${showRank?`<span class="master-explorer-rank">${rank}</span>`:''}
    </div>`;
  })).join('');
  const fenInput = $('master-explorer-fen');
  if (fenInput) fenInput.value = bozoMasterExplorerGame.fen();
}

function bozoMasterExplorerPaintHistory() {
  const target = $('master-explorer-history');
  if (!target || !bozoMasterExplorerGame) return;
  const moves = bozoMasterExplorerGame.history();

  const startLabel = bozoMasterExplorerBaseFen ? 'Loaded position' : 'Start position';
  target.innerHTML = `<button type="button" class="master-explorer-history-chip${moves.length ? '' : ' active'}" data-master-explorer-ply="0">${startLabel}</button>` +
    moves.map((move,i)=>`<button type="button" class="master-explorer-history-chip${i === moves.length - 1 ? ' active' : ''}" data-master-explorer-ply="${i+1}">${i+1}. ${escapeHtml(move)}</button>`).join('');

  target.querySelectorAll('[data-master-explorer-ply]').forEach(button => button.addEventListener('click', () => {
    const targetPly = Math.max(0, Number(button.dataset.masterExplorerPly || 0));
    const fullHistory = bozoMasterExplorerGame.history();
    try {
      const rebuilt = bozoMasterExplorerBaseFen ? new Chess(bozoMasterExplorerBaseFen) : new Chess();
      for (let i = 0; i < targetPly; i++) rebuilt.move(fullHistory[i]);
      bozoMasterExplorerGame = rebuilt;
      bozoMasterExplorerRefresh();
    } catch (error) {
      console.error('Could not jump to explorer history position:', error);
      toast('Could not jump to that position.');
    }
  }));

  const label = $('master-explorer-position-label');
  if (label) {
    if (!moves.length) label.textContent = bozoMasterExplorerBaseFen ? 'Loaded position' : 'Starting position';
    else label.textContent = `${moves.length} ply${moves.length===1?'':'ies'} from ${bozoMasterExplorerBaseFen ? 'loaded position' : 'start'}`;
  }
}

function bozoMasterExplorerStats(move) {
  const games = Number(move[2]||0);
  const white = Number(move[3]||0);
  const draws = Number(move[4]||0);
  const black = Number(move[5]||0);
  const wp = games ? white*100/games : 0;
  const dp = games ? draws*100/games : 0;
  const bp = games ? black*100/games : 0;
  return {games,wp,dp,bp};
}

async function bozoMasterExplorerRefresh() {
  if (!bozoMasterExplorerGame) return;
  bozoMasterExplorerPaintBoard();
  bozoMasterExplorerPaintHistory();

  const token = ++bozoMasterExplorerRequest;
  const status = $('master-explorer-status');
  const list = $('master-explorer-moves');
  if (!status || !list) return;

  status.textContent = 'Loading master data…';
  list.innerHTML = '<div class="master-explorer-empty">Loading master moves…</div>';

  try {
    const key = bozoMasterExplorerFenKey(bozoMasterExplorerGame.fen());
    const shardName = await bozoMasterExplorerShardName(key);
    const shard = await bozoMasterExplorerLoadShard(shardName);
    if (token !== bozoMasterExplorerRequest) return;

    const allMoves = shard.get(key) || [];
    if (!allMoves.length) {
      status.textContent = 'No retained master moves';
      list.innerHTML = '<div class="master-explorer-empty">BOZO has no retained master-game continuation from this position.</div>';
      return;
    }

    const moves = allMoves.filter(move => Number(move[2] || 0) >= bozoMasterExplorerMinGames);
    const total = moves.reduce((sum,m)=>sum+Number(m[2]||0),0);

    if (!moves.length) {
      status.textContent = `0 of ${allMoves.length} moves shown`;
      list.innerHTML = `<div class="master-explorer-empty">No continuations meet the current minimum of ${bozoMasterExplorerMinGames.toLocaleString()} games. Lower the filter to see more moves.</div>`;
      return;
    }

    status.textContent = bozoMasterExplorerMinGames > 1
      ? `${moves.length} of ${allMoves.length} moves · ${total.toLocaleString()} games`
      : `${moves.length} move${moves.length===1?'':'s'} · ${total.toLocaleString()} games`;

    list.innerHTML = moves.slice(0,20).map((move,index)=>{
      const s = bozoMasterExplorerStats(move);
      return `<button type="button" class="master-explorer-move" data-master-explorer-move="${escapeHtml(move[0])}">
        <strong>${escapeHtml(move[1]||move[0])}</strong>
        <span class="master-explorer-games">${s.games.toLocaleString()} games</span>
        <span>
          <span class="master-explorer-resultbar">
            <span class="w" style="width:${s.wp.toFixed(2)}%"></span>
            <span class="d" style="width:${s.dp.toFixed(2)}%"></span>
            <span class="b" style="width:${s.bp.toFixed(2)}%"></span>
          </span>
          <span class="master-explorer-percent">W ${s.wp.toFixed(1)}% · D ${s.dp.toFixed(1)}% · B ${s.bp.toFixed(1)}%</span>
        </span>
      </button>`;
    }).join('');

    $$('[data-master-explorer-move]').forEach(button=>button.addEventListener('click',()=>{
      const uci = button.dataset.masterExplorerMove;
      const found = bozoMasterExplorerGame.moves({verbose:true}).find(m => (m.from+m.to+(m.promotion||'')) === uci);
      if (!found) return toast('That move could not be played.');
      bozoMasterExplorerGame.move(found);
      bozoMasterExplorerRefresh();
    }));
  } catch (error) {
    console.error('Master Explorer failed:',error);
    status.textContent = 'Explorer unavailable';
    list.innerHTML = '<div class="master-explorer-empty">The master explorer data could not be loaded. Check that explorer-data was included in this deployment.</div>';
  }
}

function initializeMasterExplorer() {
  if (!$('master-explorer-board')) return;
  if (!bozoMasterExplorerGame) bozoMasterExplorerGame = new Chess();
  bozoMasterExplorerRefresh();
}

$('master-explorer-start')?.addEventListener('click',()=>{
  bozoMasterExplorerBaseFen = null;
  bozoMasterExplorerGame = new Chess();
  bozoMasterExplorerRefresh();
});

$('master-explorer-back')?.addEventListener('click',()=>{
  if (!bozoMasterExplorerGame) return;
  bozoMasterExplorerGame.undo();
  bozoMasterExplorerRefresh();
});

$('master-explorer-flip')?.addEventListener('click',()=>{
  bozoMasterExplorerOrientation = bozoMasterExplorerOrientation === 'white' ? 'black' : 'white';
  bozoMasterExplorerPaintBoard();
});

$('master-explorer-load-fen')?.addEventListener('click',()=>{
  const raw = $('master-explorer-fen')?.value?.trim();
  if (!raw) return;
  try {
    bozoMasterExplorerGame = new Chess(raw);
    bozoMasterExplorerBaseFen = bozoMasterExplorerGame.fen();
    bozoMasterExplorerRefresh();
  } catch {
    toast('That FEN is not valid.');
  }
});

$('master-explorer-min-games')?.addEventListener('change', (event)=>{
  bozoMasterExplorerMinGames = Math.max(1, Number(event.target.value || 1));
  bozoMasterExplorerRefresh();
});


function myDuelColor(c) {
  return challengeColor(c).toLowerCase();
}

function paintWebDuel() {
  const c = activeWebDuel;
  const myTurn = c.turn_user_id === state.session.user.id;
  $('duel-turn-badge').textContent = c.status === 'completed'
    ? `Finished · ${c.result || ''}`
    : myTurn ? '● your turn' : 'waiting for opponent';
  const normalizedMoves = normalizeDuelMoveHistory(c.move_history);
  $('duel-game-message').textContent = myTurn
    ? (normalizedMoves.length < c.required_plies
        ? 'Book moves are enforced.'
        : 'The game is now out of book.')
    : 'Waiting for your opponent’s move…';

  const orientation = myDuelColor(c);
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const board = fenBoard(webDuelGame.fen());
  const html=[];
  for (const rankNum of ranks) {
    for (const file of files) {
      const row=8-rankNum, col=file.charCodeAt(0)-97;
      const square=`${file}${rankNum}`;
      const symbol=board[row][col];
      const piece=webDuelGame.get(square);
      html.push(`<button data-square="${square}"
                         data-piece-color="${piece?.color === 'b' ? 'black' : piece?.color === 'w' ? 'white' : ''}"
                         class="${selectedWebSquare===square?'selected':''}">
                   ${webPiece(symbol)}
                 </button>`);
    }
  }
  $('web-duel-board').innerHTML=html.join('');
  $('web-duel-board').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => clickWebDuelSquare(button.dataset.square));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (!duelRightMouseDown) toggleDuelSquare(button.dataset.square);
    });
    button.addEventListener('mousedown', event => {
      if (event.button !== 2) return;
      event.preventDefault();
      duelRightMouseDown = true;
      duelArrowStart = button.dataset.square;
    });
    button.addEventListener('mouseup', event => {
      if (event.button !== 2 || !duelArrowStart) return;
      event.preventDefault();
      const end = button.dataset.square;
      if (end !== duelArrowStart) addDuelArrow(duelArrowStart, end);
      duelArrowStart = null;
      setTimeout(() => { duelRightMouseDown = false; }, 0);
    });
  });

  paintDuelAnnotations();
  paintDuelClock();
  paintDuelDrawOffer();

  const moves = normalizeDuelMoveHistory(c.move_history);
  $('duel-move-list').innerHTML = renderDuelMoveRows(moves);
}

async function clickWebDuelSquare(square) {
  if (!activeWebDuel || activeWebDuel.status !== 'active') return;
  if (activeWebDuel.turn_user_id !== state.session.user.id) return toast('It is not your turn.');

  if (!selectedWebSquare) {
    const piece=webDuelGame.get(square);
    if (!piece || piece.color !== (myDuelColor(activeWebDuel)==='white'?'w':'b')) return;
    selectedWebSquare=square; paintWebDuel(); return;
  }

  let move=webDuelGame.move({from:selectedWebSquare,to:square,promotion:'q'});
  if (!move) {
    selectedWebSquare=null; paintWebDuel(); return;
  }

  const { data, error } = await sb.rpc('play_opening_challenge_move',{
    challenge_id:activeWebDuel.id,
    move_san:move.san,
    resulting_fen:webDuelGame.fen()
  });
  if (error) {
    webDuelGame.undo();
    selectedWebSquare=null;
    paintWebDuel();
    return toast(readableError(error));
  }
  activeWebDuel = data;
  duelLastSignature = duelStateSignature(data);
  selectedWebSquare = null;

  // Rebuild from the server response so both clients use the same canonical history.
  webDuelGame = replayWebDuelPosition(activeWebDuel);
  activeWebDuel.draw_offer_by = null;
  activeWebDuel.draw_offer_at = null;
  paintWebDuel();
  await checkAndFinishWebDuelRules();
  await refreshOpenWebDuel(activeWebDuel.id, { force: true });
}

async function resignWebDuel() {
  if (!activeWebDuel || !confirm('Resign this Opening Duel?')) return;
  const { error } = await sb.rpc('finish_opening_challenge',{
    challenge_id:activeWebDuel.id,finish_reason:'resign',game_result:null
  });
  if (error) return toast(readableError(error));
  closeWebDuel();
  await loadChallenges();
  toast('You resigned the duel');
}


window.addEventListener('focus', () => {
  if (activeWebDuel?.id && !$('challenge-game-modal').hidden) {
    refreshOpenWebDuel(activeWebDuel.id, { force: true }).catch(() => {});
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden &&
      activeWebDuel?.id &&
      !$('challenge-game-modal').hidden) {
    refreshOpenWebDuel(activeWebDuel.id, { force: true }).catch(() => {});
  }
});


/* ============================================================
   BOZO STUDIES: BRANCHING MOVE TREES
   ============================================================ */

let studyList = [];
let activeStudy = null;
let activeStudyChapter = null;
let studyNodes = [];
let studyNodeMap = new Map();
let selectedStudyNodeId = null;
let studySelectedSquare = null;
let studyBuilderOrientation = 'white';
let studySaveTimer = null;
let latestStudyCoachText = '';

function requireStudySession() {
  if (state.session?.user?.id) return true;
  openAuth('signin');
  return false;
}

async function renderStudies() {
  const signedOutPanel = $('studies-signed-out');
  const listView = $('studies-list-view');
  const editorView = $('study-editor-view');

  // A missing optional view must never interrupt authentication or routing.
  if (!signedOutPanel || !listView || !editorView) {
    console.warn('Studies interface is unavailable in this build.');
    return;
  }

  const signedIn = Boolean(state.session?.user?.id);
  signedOutPanel.hidden = signedIn;
  listView.hidden = !signedIn;
  editorView.hidden = true;

  if (!signedIn) return;

  $('studies-list-status').textContent = 'Loading your studies…';
  const { data, error } = await sb
    .from('studies')
    .select('id,title,description,visibility,created_at,updated_at')
    .eq('owner', state.session.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    $('studies-list-status').textContent = readableError(error);
    return;
  }

  studyList = data || [];
  $('studies-list-status').textContent =
    `${studyList.length} ${studyList.length === 1 ? 'study' : 'studies'}`;

  $('studies-grid').innerHTML = studyList.length
    ? studyList.map(study => `
        <article class="study-card" data-open-study="${study.id}">
          <div class="study-card-top">
            <span>${escapeHtml(study.visibility)}</span>
            <small>${new Date(study.updated_at || study.created_at).toLocaleDateString()}</small>
          </div>
          <h3>${escapeHtml(study.title)}</h3>
          <p>${escapeHtml(study.description || 'No description yet.')}</p>
          <button class="button secondary">Open study</button>
        </article>
      `).join('')
    : `
      <div class="empty-state studies-empty">
        <h2>Your first move tree starts here</h2>
        <p>Create a study from scratch or import a variation-rich PGN from Lichess.</p>
        <button class="button primary" id="empty-new-study">Create study</button>
      </div>
    `;

  $$('[data-open-study]').forEach(card =>
    card.addEventListener('click', () => openStudyEditor(card.dataset.openStudy))
  );
  $('empty-new-study')?.addEventListener('click', openNewStudyModal);
}

function openNewStudyModal() {
  if (!requireStudySession()) return;
  $('new-study-modal').hidden = false;
  $('new-study-status').textContent = '';
}

function openImportStudyModal() {
  if (!requireStudySession()) return;
  $('import-study-modal').hidden = false;
  $('import-study-status').textContent = '';
}

async function createStudyRecord({ title, description = '', visibility = 'private', chapterTitle = 'Chapter 1' }) {
  const userId = state.session?.user?.id;
  if (!userId) throw new Error('Sign in first.');

  const { data: study, error: studyError } = await sb
    .from('studies')
    .insert({
      owner: userId,
      title: title || 'Untitled Study',
      description,
      visibility
    })
    .select()
    .single();

  if (studyError) throw studyError;

  const { data: chapter, error: chapterError } = await sb
    .from('study_chapters')
    .insert({
      study_id: study.id,
      title: chapterTitle || 'Chapter 1',
      sort_order: 0,
      starting_fen: 'startpos'
    })
    .select()
    .single();

  if (chapterError) throw chapterError;

  const start = new Chess();
  const { data: root, error: rootError } = await sb
    .from('study_nodes')
    .insert({
      chapter_id: chapter.id,
      parent_id: null,
      ply: 0,
      san: null,
      uci: null,
      fen_before: start.fen(),
      fen_after: start.fen(),
      comment: '',
      is_main_line: true,
      sort_order: 0
    })
    .select()
    .single();

  if (rootError) throw rootError;

  return { study, chapter, root };
}

async function createNewStudy() {
  const button = $('create-study-submit');
  button.disabled = true;
  $('new-study-status').textContent = 'Creating…';

  try {
    const created = await createStudyRecord({
      title: $('new-study-title').value.trim(),
      description: $('new-study-description').value.trim(),
      visibility: $('new-study-visibility').value
    });
    $('new-study-modal').hidden = true;
    await openStudyEditor(created.study.id);
  } catch (error) {
    $('new-study-status').textContent = readableError(error);
  } finally {
    button.disabled = false;
  }
}

async function openStudyEditor(studyId) {
  const [{ data: study, error: studyError }, { data: chapters, error: chapterError }] =
    await Promise.all([
      sb.from('studies').select('*').eq('id', studyId).single(),
      sb.from('study_chapters').select('*').eq('study_id', studyId).order('sort_order').limit(1)
    ]);

  if (studyError) return toast(readableError(studyError));
  if (chapterError || !chapters?.length) return toast('This study has no chapter.');

  activeStudy = study;
  activeStudyChapter = chapters[0];

  const { data: nodes, error: nodesError } = await sb
    .from('study_nodes')
    .select('*')
    .eq('chapter_id', activeStudyChapter.id)
    .order('ply')
    .order('sort_order');

  if (nodesError) return toast(readableError(nodesError));

  studyNodes = nodes || [];

  // Older or partially-created studies may not contain a root node. Repair
  // them automatically instead of leaving the board blank.
  if (!studyNodes.some(node => !node.parent_id)) {
    const start = new Chess();
    const { data: repairedRoot, error: rootError } = await sb
      .from('study_nodes')
      .insert({
        chapter_id: activeStudyChapter.id,
        parent_id: null,
        ply: 0,
        san: null,
        uci: null,
        fen_before: start.fen(),
        fen_after: start.fen(),
        comment: '',
        nag: '',
        is_main_line: true,
        sort_order: 0
      })
      .select()
      .single();

    if (rootError) return toast(readableError(rootError));
    studyNodes.unshift(repairedRoot);
  }

  rebuildStudyNodeMap();
  const root = studyNodes.find(node => !node.parent_id);
  selectedStudyNodeId = root?.id || studyNodes[0]?.id || null;
  studySelectedSquare = null;

  $('studies-list-view').hidden = true;
  $('study-editor-view').hidden = false;
  $('study-title-input').value = activeStudy.title;
  $('study-chapter-title-input').value = activeStudyChapter.title;
  $('study-autosave-state').textContent = 'Saved';

  renderStudyEditor();
}

function rebuildStudyNodeMap() {
  studyNodeMap = new Map(studyNodes.map(node => [node.id, node]));
}

function selectedStudyNode() {
  return studyNodeMap.get(selectedStudyNodeId) || null;
}

function studyChildren(parentId) {
  return studyNodes
    .filter(node => node.parent_id === parentId)
    .sort((a, b) =>
      Number(b.is_main_line) - Number(a.is_main_line) ||
      Number(a.sort_order) - Number(b.sort_order) ||
      String(a.created_at).localeCompare(String(b.created_at))
    );
}

function studyPathTo(nodeId) {
  const path = [];
  let node = studyNodeMap.get(nodeId);
  while (node) {
    path.unshift(node);
    node = node.parent_id ? studyNodeMap.get(node.parent_id) : null;
  }
  return path;
}

function studyGameAtNode(nodeId) {
  const selected = studyNodeMap.get(nodeId);

  // Saved FEN is the canonical source. Replaying SAN remains a fallback for
  // imported legacy nodes.
  if (selected?.fen_after && selected.fen_after !== 'startpos') {
    try {
      return new Chess(selected.fen_after);
    } catch (error) {
      console.warn('Invalid saved study FEN; replaying moves instead.', error);
    }
  }

  const game = new Chess();
  const path = studyPathTo(nodeId).filter(node => node.san);
  for (const node of path) {
    if (!game.move(node.san, { sloppy: true })) {
      console.warn('Could not replay study node', node);
      break;
    }
  }
  return game;
}

function renderStudyEditor() {
  paintStudyBoard();
  renderStudyMoveTree();
  renderStudyInspector();
}

function paintStudyBoard() {
  const boardElement = $('study-builder-board');
  const node = selectedStudyNode();
  if (!boardElement) return;
  if (!node) {
    boardElement.innerHTML =
      '<div class="study-board-error">No starting position was found.</div>';
    return;
  }
  const game = studyGameAtNode(node.id);
  const board = fenBoard(game.fen());
  const ranks = studyBuilderOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = studyBuilderOrientation === 'white'
    ? ['a','b','c','d','e','f','g','h']
    : ['h','g','f','e','d','c','b','a'];

  const legalTargets = studySelectedSquare
    ? game.moves({ square: studySelectedSquare, verbose: true }).map(move => move.to)
    : [];

  boardElement.innerHTML = ranks.flatMap(rank =>
    files.map(file => {
      const square = `${file}${rank}`;
      const symbol = board[8 - rank][file.charCodeAt(0) - 97];
      const piece = game.get(square);
      const classes = [];
      if (square === studySelectedSquare) classes.push('study-selected-square');
      if (legalTargets.includes(square)) classes.push('study-legal-square');

      return `<button type="button"
                      data-study-square="${square}"
                      class="${classes.join(' ')}"
                      data-piece-color="${piece?.color || ''}">
                ${webPiece(symbol)}
              </button>`;
    })
  ).join('');
  syncBoardUserAnnotationPosition('study-builder-board', `${game.fen()}|${studyBuilderOrientation}`);

  $$('[data-study-square]').forEach(button =>
    button.addEventListener('click', () => handleStudySquare(button.dataset.studySquare))
  );

  const path = studyPathTo(node.id).filter(item => item.san);
  $('study-position-label').textContent = node.san
    ? `${Math.ceil(node.ply / 2)}${node.ply % 2 ? '.' : '...'} ${node.san}`
    : 'Starting position';
  $('study-fen-label').textContent = game.fen();
}

async function handleStudySquare(square) {
  const node = selectedStudyNode();
  if (!node || !activeStudyChapter) return;

  const game = studyGameAtNode(node.id);
  const piece = game.get(square);

  if (!studySelectedSquare) {
    if (piece && piece.color === game.turn()) {
      studySelectedSquare = square;
      paintStudyBoard();
    }
    return;
  }

  if (piece && piece.color === game.turn()) {
    studySelectedSquare = square;
    paintStudyBoard();
    return;
  }

  const from = studySelectedSquare;
  studySelectedSquare = null;
  const candidate = game.moves({ square: from, verbose: true }).find(move => move.to === square);
  if (!candidate) {
    paintStudyBoard();
    return toast('That move is not legal.');
  }

  const played = game.move({
    from,
    to: square,
    promotion: candidate.promotion || 'q'
  });
  if (!played) return;

  const existing = studyChildren(node.id).find(
    child => reviewCleanSan(child.san) === reviewCleanSan(played.san)
  );

  if (existing) {
    selectedStudyNodeId = existing.id;
    renderStudyEditor();
    return;
  }

  $('study-autosave-state').textContent = 'Saving move…';
  const siblings = studyChildren(node.id);
  const { data: inserted, error } = await sb
    .from('study_nodes')
    .insert({
      chapter_id: activeStudyChapter.id,
      parent_id: node.id,
      ply: node.ply + 1,
      san: played.san,
      uci: `${played.from}${played.to}${played.promotion || ''}`,
      fen_before: node.fen_after || studyGameAtNode(node.id).fen(),
      fen_after: game.fen(),
      comment: '',
      nag: '',
      is_main_line: siblings.length === 0,
      sort_order: siblings.length
    })
    .select()
    .single();

  if (error) {
    $('study-autosave-state').textContent = 'Save failed';
    return toast(readableError(error));
  }

  studyNodes.push(inserted);
  rebuildStudyNodeMap();
  selectedStudyNodeId = inserted.id;
  $('study-autosave-state').textContent = 'Saved';
  renderStudyEditor();
}

function renderStudyMoveTree() {
  const root = studyNodes.find(node => !node.parent_id);
  if (!root) {
    $('study-move-tree').innerHTML = '<p>No root position found.</p>';
    return;
  }

  const renderBranch = (parentId, depth = 0) => {
    const children = studyChildren(parentId);
    if (!children.length) return '';

    return `<div class="study-tree-level" style="--study-depth:${depth}">
      ${children.map((node, index) => `
        <div class="study-tree-node-wrap">
          <button class="study-tree-node ${node.id === selectedStudyNodeId ? 'active' : ''} ${node.is_main_line ? 'main-line' : 'variation'}"
                  data-study-node="${node.id}">
            <span>${Math.ceil(node.ply / 2)}${node.ply % 2 ? '.' : '...'}</span>
            <b>${escapeHtml(node.san || '')}</b>
            ${node.comment ? '<i title="Has note">●</i>' : ''}
          </button>
          ${renderBranch(node.id, depth + 1)}
        </div>
      `).join('')}
    </div>`;
  };

  $('study-move-tree').innerHTML = `
    <button class="study-tree-root ${root.id === selectedStudyNodeId ? 'active' : ''}"
            data-study-node="${root.id}">Starting position</button>
    ${renderBranch(root.id)}
  `;

  $$('[data-study-node]').forEach(button =>
    button.addEventListener('click', () => {
      selectedStudyNodeId = button.dataset.studyNode;
      studySelectedSquare = null;
      renderStudyEditor();
    })
  );
}

function renderStudyInspector() {
  const node = selectedStudyNode();
  if (!node) return;
  $('study-node-comment').value = node.comment || '';
  $('study-delete-variation').disabled = !node.parent_id;
  $('study-promote-button').disabled = !node.parent_id || node.is_main_line;
}

function scheduleStudyMetadataSave() {
  clearTimeout(studySaveTimer);
  $('study-autosave-state').textContent = 'Saving…';
  studySaveTimer = setTimeout(saveStudyMetadata, 500);
}

async function saveStudyMetadata() {
  if (!activeStudy || !activeStudyChapter) return;

  const title = $('study-title-input').value.trim() || 'Untitled Study';
  const chapterTitle = $('study-chapter-title-input').value.trim() || 'Chapter 1';

  const [{ error: studyError }, { error: chapterError }] = await Promise.all([
    sb.from('studies').update({ title }).eq('id', activeStudy.id),
    sb.from('study_chapters').update({ title: chapterTitle }).eq('id', activeStudyChapter.id)
  ]);

  if (studyError || chapterError) {
    $('study-autosave-state').textContent = 'Save failed';
    return;
  }

  activeStudy.title = title;
  activeStudyChapter.title = chapterTitle;
  $('study-autosave-state').textContent = 'Saved';
}

async function saveStudyNote() {
  const node = selectedStudyNode();
  if (!node) return;
  const comment = $('study-node-comment').value.trim();
  $('study-autosave-state').textContent = 'Saving note…';

  const { error } = await sb
    .from('study_nodes')
    .update({ comment })
    .eq('id', node.id);

  if (error) {
    $('study-autosave-state').textContent = 'Save failed';
    return toast(readableError(error));
  }

  node.comment = comment;
  $('study-autosave-state').textContent = 'Saved';
  renderStudyMoveTree();
}

async function promoteStudyVariation() {
  const node = selectedStudyNode();
  if (!node?.parent_id) return;

  $('study-autosave-state').textContent = 'Promoting…';
  const siblings = studyChildren(node.parent_id);
  const siblingIds = siblings.map(item => item.id);

  if (siblingIds.length) {
    const { error: clearError } = await sb
      .from('study_nodes')
      .update({ is_main_line: false })
      .in('id', siblingIds);
    if (clearError) return toast(readableError(clearError));
  }

  const { error } = await sb
    .from('study_nodes')
    .update({ is_main_line: true, sort_order: 0 })
    .eq('id', node.id);

  if (error) return toast(readableError(error));

  siblings.forEach(item => item.is_main_line = item.id === node.id);
  $('study-autosave-state').textContent = 'Saved';
  renderStudyMoveTree();
}

function collectStudyDescendants(nodeId) {
  const collected = [];
  const visit = id => {
    for (const child of studyChildren(id)) {
      collected.push(child.id);
      visit(child.id);
    }
  };
  visit(nodeId);
  return collected;
}

async function deleteStudyVariation() {
  const node = selectedStudyNode();
  if (!node?.parent_id) return;
  if (!confirm(`Delete ${node.san} and every continuation below it?`)) return;

  const parentId = node.parent_id;
  const { error } = await sb.from('study_nodes').delete().eq('id', node.id);
  if (error) return toast(readableError(error));

  const removed = new Set([node.id, ...collectStudyDescendants(node.id)]);
  studyNodes = studyNodes.filter(item => !removed.has(item.id));
  rebuildStudyNodeMap();
  selectedStudyNodeId = parentId;
  renderStudyEditor();
  toast('Variation deleted');
}

async function deleteActiveStudy() {
  if (!activeStudy || !confirm(`Delete "${activeStudy.title}" permanently?`)) return;
  const { error } = await sb.from('studies').delete().eq('id', activeStudy.id);
  if (error) return toast(readableError(error));
  activeStudy = null;
  activeStudyChapter = null;
  studyNodes = [];
  selectedStudyNodeId = null;
  await renderStudies();
  toast('Study deleted');
}

function tokenizeStudyPgn(pgn) {
  return String(pgn || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/;[^\n\r]*/g, ' ')
    .replace(/\{([^}]*)\}/g, ' {$1} ')
    .replace(/(\(|\))/g, ' $1 ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function parseStudyPgnTree(pgn) {
  const tokens = tokenizeStudyPgn(pgn);
  const root = { san: null, comment: '', children: [] };
  const positionStack = [];
  let current = root;
  let game = new Chess();
  let lastNode = root;
  let pendingComment = '';

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];

    if (token === '(') {
      const parent = lastNode.parent || root;
      positionStack.push({ current, gameFen: game.fen(), lastNode });
      current = parent;
      game = new Chess(parent.fenAfter || new Chess().fen());
      lastNode = parent;
      continue;
    }

    if (token === ')') {
      const saved = positionStack.pop();
      if (saved) {
        current = saved.current;
        game = new Chess(saved.gameFen);
        lastNode = saved.lastNode;
      }
      continue;
    }

    if (token.startsWith('{')) {
      pendingComment = token.replace(/^\{|\}$/g, '');
      while (!token.endsWith('}') && index + 1 < tokens.length) {
        index++;
        pendingComment += ` ${tokens[index].replace(/\}$/, '')}`;
        if (tokens[index].endsWith('}')) break;
      }
      if (lastNode !== root) lastNode.comment = pendingComment.trim();
      pendingComment = '';
      continue;
    }

    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    if (/^[!?]+$/.test(token)) {
      if (lastNode !== root) lastNode.nag = token;
      continue;
    }

    const before = game.fen();
    const move = game.move(token, { sloppy: true });
    if (!move) continue;

    let node = current.children.find(
      child => reviewCleanSan(child.san) === reviewCleanSan(move.san)
    );
    if (!node) {
      node = {
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        fenBefore: before,
        fenAfter: game.fen(),
        comment: pendingComment,
        nag: '',
        children: [],
        parent: current
      };
      current.children.push(node);
    }

    current = node;
    lastNode = node;
    pendingComment = '';
  }

  return root;
}

async function persistImportedTree(root, chapterId, rootId) {
  const queue = root.children.map((node, index) => ({
    node,
    parentId: rootId,
    ply: 1,
    main: index === 0,
    sortOrder: index
  }));

  while (queue.length) {
    const item = queue.shift();
    const { data: inserted, error } = await sb
      .from('study_nodes')
      .insert({
        chapter_id: chapterId,
        parent_id: item.parentId,
        ply: item.ply,
        san: item.node.san,
        uci: item.node.uci,
        fen_before: item.node.fenBefore,
        fen_after: item.node.fenAfter,
        comment: item.node.comment || '',
        nag: item.node.nag || '',
        is_main_line: item.main,
        sort_order: item.sortOrder
      })
      .select()
      .single();

    if (error) throw error;

    item.node.children.forEach((child, index) => queue.push({
      node: child,
      parentId: inserted.id,
      ply: item.ply + 1,
      main: index === 0,
      sortOrder: index
    }));
  }
}

async function importStudyPgn() {
  const pgn = $('import-study-pgn').value.trim();
  if (!pgn) {
    $('import-study-status').textContent = 'Paste a PGN first.';
    return;
  }

  const button = $('import-study-submit');
  button.disabled = true;
  $('import-study-status').textContent = 'Parsing variations…';

  try {
    const tree = parseStudyPgnTree(pgn);
    if (!tree.children.length) throw new Error('No legal moves were found in this PGN.');

    const created = await createStudyRecord({
      title: $('import-study-title').value.trim() || 'Imported Study',
      chapterTitle: $('import-chapter-title').value.trim() || 'Chapter 1'
    });

    $('import-study-status').textContent = 'Saving move tree…';
    await persistImportedTree(tree, created.chapter.id, created.root.id);
    $('import-study-modal').hidden = true;
    await openStudyEditor(created.study.id);
    toast('Study imported');
  } catch (error) {
    $('import-study-status').textContent = readableError(error);
  } finally {
    button.disabled = false;
  }
}

function studyNodePgn(node, moveNumber, side) {
  const prefix = side === 'w' ? `${moveNumber}. ` : `${moveNumber}... `;
  const comment = node.comment ? ` {${node.comment.replace(/[{}]/g, '')}}` : '';
  return `${prefix}${node.san}${node.nag || ''}${comment}`;
}

function exportStudyPgnText() {
  const root = studyNodes.find(node => !node.parent_id);
  if (!root) return '';

  const renderFrom = (parentId, moveNumber = 1, side = 'w') => {
    const children = studyChildren(parentId);
    if (!children.length) return '';

    const main = children.find(node => node.is_main_line) || children[0];
    const variations = children.filter(node => node.id !== main.id);

    let text = studyNodePgn(main, moveNumber, side);
    const nextMove = side === 'b' ? moveNumber + 1 : moveNumber;
    const nextSide = side === 'w' ? 'b' : 'w';

    for (const variation of variations) {
      const variationText =
        studyNodePgn(variation, moveNumber, side) +
        ' ' +
        renderFrom(variation.id, nextMove, nextSide);
      text += ` (${variationText.trim()})`;
    }

    const continuation = renderFrom(main.id, nextMove, nextSide);
    if (continuation) text += ` ${continuation}`;
    return text.trim();
  };

  return `[Event "${(activeStudy?.title || 'BOZO Study').replace(/"/g, "'")}"]
[Chapter "${(activeStudyChapter?.title || 'Chapter 1').replace(/"/g, "'")}"]
[Site "BOZO'S Opening Trainer"]

${renderFrom(root.id)} *`;
}

function exportActiveStudy() {
  const pgn = exportStudyPgnText();
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(activeStudy?.title || 'bozo-study').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pgn`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function askStudyCoach() {
  const node = selectedStudyNode();
  if (!node) return;
  const path = studyPathTo(node.id).filter(item => item.san);
  const siblings = node.parent_id
    ? studyChildren(node.parent_id).filter(item => item.id !== node.id)
    : [];
  const continuation = [];
  let cursor = node;
  for (let index = 0; index < 6; index++) {
    const next = studyChildren(cursor.id).find(item => item.is_main_line) || studyChildren(cursor.id)[0];
    if (!next) break;
    continuation.push(next.san);
    cursor = next;
  }

  const studyCoachFacts = verifiedCoachFacts(node.fen_after, node.fen_before, node.san || '');
  const button = $('ask-study-coach');
  button.disabled = true;
  button.textContent = 'Thinking…';
  $('study-coach-answer').textContent = 'BOZO is reading the branch…';

  try {
    const { data, error } = await sb.functions.invoke('explain-move', {
      body: {
        mode: 'study',
        gameStatus: 'study',
        move: node.san || 'Starting position',
        fen: node.fen_after,
        fenBefore: node.fen_before,
        question: $('study-coach-question').value.trim() ||
          'Explain why this move belongs in the study, compare its sibling variations, and give the practical plan.',
        opening: activeStudy?.title || 'Study',
        variation: activeStudyChapter?.title || 'Chapter',
        moveHistory: path.map(item => item.san),
        contextBeforeMoves: path.slice(-8).map(item => item.san),
        actualContinuation: continuation,
        siblingVariations: siblings.map(item => item.san),
        existingNote: node.comment || '',
        classification: 'Study move',
        verifiedBoardFacts: studyCoachFacts,
        strictGrounding: true
      }
    });
    if (error) throw error;

    const explanation = sanitizeCoachExplanation(data?.explanation || data, studyCoachFacts);
    latestStudyCoachText = [
      explanation?.summary,
      explanation?.howWeGotHere,
      explanation?.comparison,
      ...(explanation?.practicalPlan || [])
    ].filter(Boolean).join('\n\n');

    $('study-coach-answer').innerHTML = `
      <p>${escapeHtml(explanation?.summary || 'No explanation returned.')}</p>
      ${explanation?.howWeGotHere ? `<div><b>Context</b><p>${escapeHtml(explanation.howWeGotHere)}</p></div>` : ''}
      ${explanation?.comparison ? `<div><b>Variation comparison</b><p>${escapeHtml(explanation.comparison)}</p></div>` : ''}
      ${Array.isArray(explanation?.practicalPlan) ? `
        <div><b>Practical plan</b>
          <ol>${explanation.practicalPlan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
        </div>` : ''}
      ${explanation?.watchFor ? `<div class="coach-warning"><b>Watch for:</b><span>${escapeHtml(explanation.watchFor)}</span></div>` : ''}
    `;
    $('save-coach-as-note').hidden = !latestStudyCoachText;
  } catch (error) {
    $('study-coach-answer').textContent = readableError(error);
  } finally {
    button.disabled = false;
    button.textContent = 'Ask BOZO Coach';
  }
}

async function saveCoachAsStudyNote() {
  if (!latestStudyCoachText) return;
  const existing = $('study-node-comment').value.trim();
  $('study-node-comment').value =
    [existing, `BOZO Coach:\n${latestStudyCoachText}`].filter(Boolean).join('\n\n');
  await saveStudyNote();
}

function setStudyInspectorTab(tab) {
  $$('[data-study-tab]').forEach(button =>
    button.classList.toggle('active', button.dataset.studyTab === tab)
  );
  $('study-notes-tab').hidden = tab !== 'notes';
  $('study-coach-tab').hidden = tab !== 'coach';
}

$('new-study-button')?.addEventListener('click', openNewStudyModal);
$('import-study-button')?.addEventListener('click', openImportStudyModal);
$('close-new-study-modal')?.addEventListener('click', () => { const modal = $('new-study-modal'); if (modal) modal.hidden = true; });
$('close-import-study-modal')?.addEventListener('click', () => { const modal = $('import-study-modal'); if (modal) modal.hidden = true; });
$('create-study-submit')?.addEventListener('click', createNewStudy);
$('import-study-submit')?.addEventListener('click', importStudyPgn);
$('close-study-editor')?.addEventListener('click', renderStudies);
$('study-title-input')?.addEventListener('input', scheduleStudyMetadataSave);
$('study-chapter-title-input')?.addEventListener('input', scheduleStudyMetadataSave);
$('study-save-note')?.addEventListener('click', saveStudyNote);
$('study-promote-button')?.addEventListener('click', promoteStudyVariation);
$('study-delete-variation')?.addEventListener('click', deleteStudyVariation);
$('study-delete-button')?.addEventListener('click', deleteActiveStudy);
$('study-export-button')?.addEventListener('click', exportActiveStudy);
$('study-start-button')?.addEventListener('click', () => {
  const root = studyNodes.find(node => !node.parent_id);
  if (root) {
    selectedStudyNodeId = root.id;
    studySelectedSquare = null;
    renderStudyEditor();
  }
});
$('study-previous-button')?.addEventListener('click', () => {
  const node = selectedStudyNode();
  if (node?.parent_id) {
    selectedStudyNodeId = node.parent_id;
    studySelectedSquare = null;
    renderStudyEditor();
  }
});
$('study-flip-button')?.addEventListener('click', () => {
  studyBuilderOrientation = studyBuilderOrientation === 'white' ? 'black' : 'white';
  paintStudyBoard();
});
$$('[data-study-tab]').forEach(button =>
  button.addEventListener('click', () => setStudyInspectorTab(button.dataset.studyTab))
);
$('ask-study-coach')?.addEventListener('click', askStudyCoach);
$('save-coach-as-note')?.addEventListener('click', saveCoachAsStudyNote);


/* ============================================================
   BOZO BOARD DISPLAY: CONSISTENT PIECES + RESPONSIVE SIZING
   ============================================================ */
const BOZO_BOARD_SIZES = ['compact', 'medium', 'large'];

function currentBozoBoardSize() {
  const saved = localStorage.getItem('bozo_board_size');
  return BOZO_BOARD_SIZES.includes(saved) ? saved : 'medium';
}

function applyBozoBoardSize(size) {
  const resolved = BOZO_BOARD_SIZES.includes(size) ? size : 'medium';
  document.documentElement.dataset.bozoBoardSize = resolved;
  localStorage.setItem('bozo_board_size', resolved);
  document.querySelectorAll('[data-bozo-board-size]').forEach(button => {
    button.classList.toggle('active', button.dataset.bozoBoardSize === resolved);
  });
  window.dispatchEvent(new Event('resize'));
}

function makeBozoBoardSizeControl() {
  const control = document.createElement('div');
  control.className = 'bozo-board-size-control';
  control.innerHTML = `
    <span>Board size</span>
    ${BOZO_BOARD_SIZES.map(size => `
      <button type="button" data-bozo-board-size="${size}">
        ${size[0].toUpperCase() + size.slice(1)}
      </button>`).join('')}
  `;
  control.querySelectorAll('[data-bozo-board-size]').forEach(button => {
    button.addEventListener('click', () => applyBozoBoardSize(button.dataset.bozoBoardSize));
  });
  return control;
}

function initializeBozoBoardDisplay() {
  applyBozoBoardSize(currentBozoBoardSize());
  const targets = [
    '#study-modal .study-board-shell',
    '#study-editor-view .study-board-shell',
    '#challenge-game-modal .friend-board-shell',
    '#bot-game-modal .bot-board-shell',
    '#view-review .review-board-frame',
    '#view-masters .master-board-frame'
  ];
  targets.forEach(selector => {
    const shell = document.querySelector(selector);
    if (!shell || shell.parentElement?.querySelector(':scope > .bozo-board-size-control')) return;
    shell.insertAdjacentElement('beforebegin', makeBozoBoardSizeControl());
  });
  applyBozoBoardSize(currentBozoBoardSize());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBozoBoardDisplay, { once:true });
} else {
  initializeBozoBoardDisplay();
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

sb.auth.onAuthStateChange(async (event, session) => {
  state.session = session;

  if (event === 'PASSWORD_RECOVERY') {
    showNewPasswordState();
  }

  await loadIdentity();
});
setTimeout(async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('recovery') === '1') {
    const { data } = await sb.auth.getSession();
    if (data?.session) showNewPasswordState();
  }
}, 250);


(async function init() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadIdentity();

  const params = new URLSearchParams(window.location.search);
  const verifiedReturn = params.get('verified') === '1';

  if (verifiedReturn) {
    params.delete('verified');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash || ''}`;
    history.replaceState({}, '', cleanUrl);
    queueMicrotask(() => {
      route('home');
      showVerifiedState();
    });
    return;
  }

  queueMicrotask(() => route((location.hash || '#home').slice(1)));
})();


// BOZO v2.7.6: public beta notice
function openPublicBetaModal() { $('public-beta-modal').hidden = false; }
function closePublicBetaModal() { $('public-beta-modal').hidden = true; }
$('public-beta-learn-more').addEventListener('click', openPublicBetaModal);
$('close-public-beta-modal').addEventListener('click', closePublicBetaModal);
$('public-beta-modal-close-button').addEventListener('click', closePublicBetaModal);
$('public-beta-modal').addEventListener('click', event => {
  if (event.target.id === 'public-beta-modal') closePublicBetaModal();
});
function openBetaIssueReport() {
  closePublicBetaModal();
  openCommunityFeedback('report');
}
$('public-beta-report').addEventListener('click', openBetaIssueReport);
$('public-beta-modal-report').addEventListener('click', openBetaIssueReport);


// WEB v3.0.0: Recall Training + Opening Puzzles + Phase-Aware Review
let trainOpening = null;
let trainGame = null;
let trainMoves = [];
let trainUserSide = 'white';
let trainPly = 0;
let trainSelectedSquare = null;
let trainAttemptsForPly = 0;
let trainStats = { userMoves: 0, firstTry: 0, mistakes: 0 };
let trainSearchTimer = null;

function trainingStorageKey(id) { return `bozo_training_v1_${id}`; }

function prepareTrainPage() {
  if (!$('train-session') || !$('train-picker')) return;
  if (!trainOpening) {
    $('train-picker').hidden = false;
    $('train-session').hidden = true;
    $('train-results').hidden = true;
  }
}

$('train-search-button')?.addEventListener('click', () => searchTrainOpenings($('train-opening-search').value));
$('train-opening-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchTrainOpenings(e.currentTarget.value); });
$('train-opening-search')?.addEventListener('input', e => {
  clearTimeout(trainSearchTimer);
  trainSearchTimer = setTimeout(() => { if (e.currentTarget.value.trim().length >= 2) searchTrainOpenings(e.currentTarget.value); }, 280);
});
$('train-new-line')?.addEventListener('click', () => resetCurrentTrainMode());
$('train-restart')?.addEventListener('click', () => beginTrainSession());
$('train-again')?.addEventListener('click', () => beginTrainSession());
$('train-study-line')?.addEventListener('click', () => { if (trainOpening) openStudyOpening(trainOpening.id, { repertoireSide: trainUserSide }); });
$('train-hint')?.addEventListener('click', showTrainHint);
$('train-show-answer')?.addEventListener('click', showTrainAnswer);

async function searchTrainOpenings(query = '') {
  const root = $('train-opening-results');
  if (!root) return;
  const text = query.trim();
  root.innerHTML = '<div class="empty-state"><div>⌛</div><b>Searching theory…</b></div>';
  let req = sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('status','published').limit(60);
  if (text) req = req.or(`name.ilike.%${text}%,variation.ilike.%${text}%,eco.ilike.%${text}%`);
  const { data, error } = await req.order('name');
  if (error) { root.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load openings</b><span>${escapeHtml(readableError(error))}</span></div>`; return; }
  const rows = (data || []).filter(row => row.pgn);
  if (!rows.length) { root.innerHTML = '<div class="empty-state"><div>♟</div><b>No matching lines</b><span>Try a broader opening name.</span></div>'; return; }
  root.innerHTML = rows.slice(0, 40).map(row => {
    const side = inferOpeningSide(row);
    return `<button class="train-opening-result" type="button" data-train-opening="${row.id}"><span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.variation || 'Main Line')} · ${escapeHtml(row.eco || 'ECO  - ')}</small></span><em>${side === 'neutral' ? 'Choose side' : `Train ${side}`}</em></button>`;
  }).join('');
  root.querySelectorAll('[data-train-opening]').forEach(button => button.addEventListener('click', () => startTrainingOpening(button.dataset.trainOpening)));
}

async function startTrainingOpening(openingId) {
  route('train');
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('id', openingId).maybeSingle();
  if (error || !data) return toast(readableError(error || new Error('Opening not found')));
  const parser = new Chess();
  if (!parser.load_pgn(data.pgn, { sloppy: true })) return toast('This opening line could not be loaded.');
  trainOpening = data;
  trainMoves = parser.history();
  const inferred = inferOpeningSide(data);
  trainUserSide = inferred === 'black' ? 'black' : 'white';
  beginTrainSession();
}
window.startTrainingOpening = startTrainingOpening;

function beginTrainSession() {
  if (!trainOpening || !trainMoves.length) return;
  trainGame = new Chess();
  trainPly = 0;
  trainSelectedSquare = null;
  trainAttemptsForPly = 0;
  trainStats = { userMoves: 0, firstTry: 0, mistakes: 0 };
  $('train-picker').hidden = true;
  $('train-results').hidden = true;
  $('train-session').hidden = false;
  $('train-title').textContent = trainOpening.name;
  $('train-subtitle').textContent = `${trainOpening.variation || 'Main Line'} · ${trainOpening.eco || 'ECO  - '} · training as ${trainUserSide}`;
  setTrainFeedback('neutral', 'Your move.', 'Find the repertoire move from memory.');
  advanceTrainOpponentMoves();
  paintTrainBoard();
  updateTrainUI();
}

function trainSideToMove() { return trainGame?.turn() === 'b' ? 'black' : 'white'; }
function isTrainUserTurn() { return trainSideToMove() === trainUserSide; }

function advanceTrainOpponentMoves() {
  while (trainPly < trainMoves.length && !isTrainUserTurn()) {
    const san = trainMoves[trainPly];
    const move = trainGame.move(san, { sloppy: true });
    if (!move) break;
    trainPly++;
  }
  if (trainPly >= trainMoves.length) finishTrainSession();
}

function paintTrainBoard() {
  const boardEl = $('train-board');
  if (!boardEl || !trainGame) return;
  const orientation = trainUserSide;
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = orientation === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const html = [];
  for (const rank of ranks) for (const file of files) {
    const square = `${file}${rank}`;
    const piece = trainGame.get(square);
    const symbol = piece ? `${piece.color}${piece.type.toUpperCase()}` : '';
    html.push(`<button type="button" data-square="${square}" data-piece-color="${piece?.color === 'w' ? 'white' : piece?.color === 'b' ? 'black' : ''}" class="${trainSelectedSquare === square ? 'selected' : ''}">${webPiece(symbol)}</button>`);
  }
  boardEl.innerHTML = html.join('');
  syncBoardUserAnnotationPosition('train-board', `${trainGame.fen()}|${trainUserSide}`);
  boardEl.querySelectorAll('button').forEach(button => button.addEventListener('click', () => clickTrainSquare(button.dataset.square)));
}

function clickTrainSquare(square) {
  if (!trainGame || trainPly >= trainMoves.length || !isTrainUserTurn()) return;
  const myColor = trainUserSide === 'white' ? 'w' : 'b';
  if (!trainSelectedSquare) {
    const piece = trainGame.get(square);
    if (!piece || piece.color !== myColor) return;
    trainSelectedSquare = square; paintTrainBoard(); return;
  }
  const from = trainSelectedSquare;
  trainSelectedSquare = null;
  const move = trainGame.move({ from, to: square, promotion: 'q' });
  if (!move) { paintTrainBoard(); return; }
  const expectedSan = trainMoves[trainPly];
  trainGame.undo();
  trainAttemptsForPly++;
  if (move.san !== expectedSan) {
    trainStats.mistakes++;
    setTrainFeedback('wrong', 'Not quite.', trainAttemptsForPly === 1 ? 'Try that position again.' : 'Use Hint if you want a nudge.');
    paintTrainBoard(); updateTrainUI(); return;
  }
  trainGame.move(expectedSan, { sloppy: true });
  trainStats.userMoves++;
  if (trainAttemptsForPly === 1) trainStats.firstTry++;
  trainPly++;
  setTrainFeedback('correct', 'Correct!', expectedSan);
  trainAttemptsForPly = 0;
  advanceTrainOpponentMoves();
  paintTrainBoard(); updateTrainUI();
}

function expectedTrainMove() {
  if (!trainGame || trainPly >= trainMoves.length || !isTrainUserTurn()) return null;
  const clone = new Chess(trainGame.fen());
  return clone.move(trainMoves[trainPly], { sloppy: true });
}

function showTrainHint() {
  const move = expectedTrainMove();
  if (!move) return;
  const piece = trainGame.get(move.from);
  const names = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };
  setTrainFeedback('hint', 'Hint', `Look for a ${names[piece?.type] || 'piece'} move from the ${move.from[0]}-file.`);
}
function showTrainAnswer() {
  const move = expectedTrainMove();
  if (!move) return;
  setTrainFeedback('answer', 'Answer', `${move.san} · ${move.from} → ${move.to}`);
}
function setTrainFeedback(stateName, title, copy) {
  const el = $('train-feedback'); if (!el) return;
  el.dataset.state = stateName; el.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span>`;
}
function updateTrainUI() {
  if (!trainGame) return;
  const totalUserMoves = trainMoves.reduce((count, _, i) => count + (((i % 2 === 0) ? 'white' : 'black') === trainUserSide ? 1 : 0), 0);
  const accuracy = trainStats.userMoves ? Math.round(trainStats.firstTry / trainStats.userMoves * 100) : 0;
  $('train-first-try').textContent = `${accuracy}%`;
  $('train-mistakes').textContent = trainStats.mistakes;
  $('train-progress').textContent = `${trainStats.userMoves}/${totalUserMoves}`;
  $('train-track-fill').style.width = `${totalUserMoves ? trainStats.userMoves / totalUserMoves * 100 : 0}%`;
  $('train-turn-label').textContent = trainPly >= trainMoves.length ? 'Line complete' : `${trainSideToMove()[0].toUpperCase()+trainSideToMove().slice(1)} to move`;
  $('train-instruction').textContent = isTrainUserTurn() ? 'Find your repertoire move.' : 'BOZO is playing the book reply.';
  const history = trainGame.history();
  $('train-move-history').innerHTML = history.length ? history.map((m,i)=>`<span>${i%2===0 ? `${Math.floor(i/2)+1}.` : ''} ${escapeHtml(m)}</span>`).join('') : '<small>No moves yet.</small>';
}
function finishTrainSession() {
  if (!$('train-results') || !trainOpening) return;
  $('train-session').hidden = true;
  $('train-results').hidden = false;
  const accuracy = trainStats.userMoves ? Math.round(trainStats.firstTry / trainStats.userMoves * 100) : 0;
  $('train-result-accuracy').textContent = `${accuracy}%`;
  $('train-result-mistakes').textContent = trainStats.mistakes;
  $('train-result-moves').textContent = trainStats.userMoves;
  $('train-results-title').textContent = accuracy === 100 ? 'Perfect recall.' : accuracy >= 80 ? 'Strong line.' : accuracy >= 60 ? 'Getting there.' : 'This one needs another pass.';
  try {
    const previous = JSON.parse(localStorage.getItem(trainingStorageKey(trainOpening.id)) || '{}');
    localStorage.setItem(trainingStorageKey(trainOpening.id), JSON.stringify({ attempts:(previous.attempts||0)+1, bestAccuracy:Math.max(previous.bestAccuracy||0, accuracy), lastAccuracy:accuracy, mistakes:trainStats.mistakes, trainedAt:new Date().toISOString() }));
  } catch {}
  logActivity?.('opening_trained', { opening_id: trainOpening.id, opening: trainOpening.name, variation: trainOpening.variation || 'Main Line', accuracy }).catch?.(()=>{});
}


// WEB v2.9.0: Opening Puzzle Engine
let trainMode = 'recall';
let puzzleOpening = null;
let puzzlePool = [];
let puzzleGame = null;
let puzzleMoves = [];
let puzzleUserSide = 'white';
let puzzleStartPly = 0;
let puzzlePly = 0;
let puzzleTargetUserMoves = 1;
let puzzleSolvedInCurrent = 0;
let puzzleSelectedSquare = null;
let puzzleAttemptsForPly = 0;
let puzzleHintUsed = false;
let puzzleAnswerUsed = false;
let puzzleSearchTimer = null;
let puzzleUsedStarts = new Set();
let puzzleCompleting = false;
let puzzleCandidateMoves = [];
let puzzleCandidateFen = '';
let puzzleBranchMode = true;
let puzzleGeneralMode = false;
let puzzleGeneralFen = '';
let puzzleGeneralHistory = [];
const PUZZLE_BRANCH_DEPTH = 12;
const PUZZLE_PLAYABLE_CP_WINDOW = 110;
const PUZZLE_GENERATION_DEPTH = 13;
const PUZZLE_VERIFY_DEPTH = 15;
const PUZZLE_SACRIFICE_VERIFY_DEPTH = 17;
const PUZZLE_MIN_NONKING_PIECES = 10;
const PUZZLE_MAX_GENERATION_ATTEMPTS = 36;
const PUZZLE_TARGETED_GENERATION_ATTEMPTS = 42;
const PUZZLE_MIN_TACTICAL_GAP = 65;
const PUZZLE_MAX_QUIET_EVAL = 650;
const PUZZLE_MAX_ROOT_MATERIAL_IMBALANCE = 3;
const PUZZLE_MIN_SIDE_MATERIAL = 18;
const PUZZLE_MIN_SIDE_PIECES = 7;
const PUZZLE_MIN_SIDE_NONPAWN_PIECES = 2;
const PUZZLE_SACRIFICE_MIN_INVESTMENT = 2;
const PUZZLE_SACRIFICE_MIN_RECOVERY = 2;
let puzzleGeneralMotif = '';
let puzzleMotifHistory = [];
let puzzleStats = { index:0, total:5, score:0, streak:0, bestStreak:0, userMoves:0, firstTry:0, mistakes:0, skipped:0 };
// WEB v4.11.3: Loose-major puzzle quality hardening
let puzzleRunMode = 'standard';
let puzzleRunSeconds = 0;
let puzzleRunDeadline = 0;
let puzzleRunTimer = null;
let puzzleRunStrikes = 3;
let puzzleRunHints = 3;
let puzzleRunHintsUsed = 0;
let puzzleRunSolved = 0;
let puzzleRunStartedAt = 0;
let puzzleCurrentStartedAt = 0;
let puzzleSolveTimes = [];
let puzzleRunOutcomes = [];
let puzzleRunReviewItems = [];
let puzzleCurrentReviewItem = null;
let puzzleReviewIndex = 0;
let puzzlePeakDifficulty = 0;
let puzzleResolutionEvals = [];
let puzzleCurrentDifficulty = 0;
let puzzleFailedCurrent = false;
let puzzleMasterSourceMode = false;
let puzzleMasterSource = null;
const PUZZLE_RUN_CONFIG = {
  standard:{label:'Standard',seconds:0,limited:false},
  bullet:{label:'Bullet Rush',seconds:60,limited:true},
  rush3:{label:'Puzzle Rush · 3 min',seconds:180,limited:true},
  rush5:{label:'Puzzle Rush · 5 min',seconds:300,limited:true},
  survival:{label:'Puzzle Survival',seconds:0,limited:true}
};
function isPuzzleRunMode(){ return puzzleGeneralMode && puzzleRunMode !== 'standard'; }
function isTimedPuzzleRun(){ return ['bullet','rush3','rush5'].includes(puzzleRunMode); }
function puzzleRunConfig(){ return PUZZLE_RUN_CONFIG[puzzleRunMode] || PUZZLE_RUN_CONFIG.standard; }

let puzzleCloudMode = 'bullet';
function puzzleCloudSignedIn(){ return Boolean(state?.session?.user?.id); }
function puzzleModeLabel(mode){ return PUZZLE_RUN_CONFIG[mode]?.label || mode; }
function puzzleCloudSetStatus(message='', stateName=''){
  const root=$('puzzle-cloud-save-status'); if(!root) return;
  root.hidden=!message; root.textContent=message; root.dataset.state=stateName||'';
}
function puzzleCloudDate(value){ try{return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch{return '';} }
function puzzleCloudSeconds(value){ const n=Number(value||0); return n>0?`${n.toFixed(1)}s`:' - '; }
async function loadPuzzleCloudData(mode=puzzleCloudMode){
  if (!['bullet','rush3','rush5','survival'].includes(mode)) mode='bullet';
  puzzleCloudMode=mode;
  $$('[data-puzzle-cloud-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.puzzleCloudMode===mode));
  const leaderboard=$('puzzle-cloud-leaderboard'), history=$('puzzle-cloud-history');
  if(leaderboard) leaderboard.innerHTML='<div class="empty-state mini"><span>Loading leaderboard…</span></div>';
  if(history) history.innerHTML=puzzleCloudSignedIn()?'<div class="empty-state mini"><span>Loading your runs…</span></div>':'<div class="empty-state mini"><span>Sign in to save run history.</span></div>';
  const uid=state?.session?.user?.id;
  try{
    const jobs=[sb.rpc('get_puzzle_leaderboard',{p_mode:mode,p_limit:10})];
    if(uid){
      jobs.push(sb.from('puzzle_personal_bests').select('*').eq('user_id',uid).eq('mode',mode).maybeSingle());
      jobs.push(sb.from('puzzle_runs').select('id,score,hints_used,avg_solve_time,ended_reason,duration_seconds,created_at').eq('user_id',uid).eq('mode',mode).order('created_at',{ascending:false}).limit(6));
    }
    const results=await Promise.all(jobs);
    const lbRes=results[0];
    if(lbRes.error) throw lbRes.error;
    const rows=lbRes.data||[];
    if(leaderboard) leaderboard.innerHTML=rows.length?rows.map((row,i)=>`<div class="puzzle-cloud-row"><span class="puzzle-cloud-rank">#${i+1}</span><span class="puzzle-cloud-player"><b>${escapeHtml(row.ign||row.username||'BOZO player')}</b><small>@${escapeHtml(row.username||'player')}</small></span><span class="puzzle-cloud-score">${Number(row.score||0)}<small>${puzzleCloudSeconds(row.avg_solve_time)}</small></span></div>`).join(''):'<div class="empty-state mini"><span>No cloud runs yet. Be the first.</span></div>';
    const bestScore=$('puzzle-cloud-best-score'), bestDetail=$('puzzle-cloud-best-detail'), runCount=$('puzzle-cloud-run-count');
    if(!uid){ if(bestScore) bestScore.textContent=' - '; if(bestDetail) bestDetail.textContent='Sign in to sync records'; if(runCount) runCount.textContent=' - '; return; }
    const pbRes=results[1], histRes=results[2];
    if(pbRes.error) throw pbRes.error; if(histRes.error) throw histRes.error;
    const pb=pbRes.data;
    if(bestScore) bestScore.textContent=pb?String(pb.best_score):'0';
    if(bestDetail) bestDetail.textContent=pb?'Best solved count across synced runs':'No synced best yet';
    if(runCount) runCount.textContent=pb?String(pb.total_runs||0):'0';
    const myRuns=histRes.data||[];
    if(history) {
      history.innerHTML=myRuns.length?myRuns.map(row=>`<button type="button" class="puzzle-cloud-row puzzle-cloud-run-button" data-puzzle-cloud-run="${escapeHtml(row.id)}"><span class="puzzle-cloud-rank">${puzzleCloudDate(row.created_at)}</span><span class="puzzle-cloud-player"><b>${Number(row.score||0)} solved</b><small>${escapeHtml(row.ended_reason||'complete')} · ${Number(row.hints_used||0)} hint${Number(row.hints_used||0)===1?'':'s'} used</small></span><span class="puzzle-cloud-score">${Number(row.avg_solve_time||0)>0?Number(row.avg_solve_time).toFixed(1)+'s':' - '}<small>Review →</small></span></button>`).join(''):'<div class="empty-state mini"><span>No runs saved for this mode yet.</span></div>';
      history.querySelectorAll('[data-puzzle-cloud-run]').forEach(button=>button.addEventListener('click',()=>loadCloudPuzzleRunReview(button.dataset.puzzleCloudRun)));
    }
  }catch(error){
    console.warn('Puzzle cloud records unavailable.',error);
    if(leaderboard) leaderboard.innerHTML='<div class="empty-state mini"><span>Cloud records need the v4.11.2 Supabase migration.</span></div>';
    if(history && puzzleCloudSignedIn()) history.innerHTML='<div class="empty-state mini"><span>Run history unavailable until Supabase is updated.</span></div>';
  }
}
async function savePuzzleRunCloud(payload){
  if(!puzzleCloudSignedIn() || !isPuzzleRunMode()) return null;
  puzzleCloudSetStatus('Syncing this run to your BOZO account…');
  const {data,error}=await sb.rpc('record_puzzle_run',{
    p_mode:puzzleRunMode,
    p_score:Number(payload.score||0),
    p_accuracy:0,
    p_best_streak:0,
    p_hints_used:Number(payload.hintsUsed||0),
    p_avg_solve_time:Number(payload.avgSolve||0),
    p_peak_difficulty:Number(payload.peakDifficulty||0),
    p_ended_reason:String(payload.reason||'complete'),
    p_duration_seconds:Number(payload.durationSeconds||0)
  });
  if(error){ console.warn('Could not sync puzzle run.',error); puzzleCloudSetStatus('Run finished, but cloud sync failed. Apply the current puzzle Supabase migrations and try again.','error'); return null; }
  const runId=data;
  const reviewItems=Array.isArray(payload.items)?payload.items:[];
  if(runId && reviewItems.length){
    const uid=state?.session?.user?.id;
    const rows=reviewItems.slice(0,120).map((item,index)=>({
      run_id:runId,user_id:uid,item_index:index,fen:item.fen,result:item.result||'unknown',
      attempted_move:item.attemptedMove||null,played_line:item.playedLine||[],solution_pv:item.solutionPv||[],
      motif:item.motif||null,hint_used:Boolean(item.hintUsed)
    }));
    const detail=await sb.from('puzzle_run_items').insert(rows);
    if(detail.error) console.warn('Run summary synced, but puzzle-by-puzzle review did not sync.',detail.error);
  }
  puzzleCloudSetStatus('Run synced. Personal bests, history, and review are updated.','ok');
  loadPuzzleCloudData(puzzleRunMode).catch(()=>{});
  return runId;
}


function puzzleStorageKey() { return puzzleGeneralMode ? 'bozo_general_puzzles_v1' : 'bozo_opening_puzzles_v1'; }

function setTrainMode(mode = 'recall') {
  trainMode = mode === 'master-puzzles' ? 'master-puzzles' : mode === 'bozo-puzzles' ? 'bozo-puzzles' : mode === 'puzzles' ? 'puzzles' : 'recall';
  puzzleGeneralMode = trainMode === 'bozo-puzzles';
  const recall = trainMode === 'recall', masterPuzzles=trainMode==='master-puzzles';
  $('train-recall-mode').hidden = !recall;
  $('train-puzzle-mode').hidden = recall || masterPuzzles;
  if ($('train-master-puzzles-mode')) $('train-master-puzzles-mode').hidden=!masterPuzzles;
  $('train-mode-recall')?.classList.toggle('active', recall);
  $('train-mode-puzzles')?.classList.toggle('active', trainMode === 'puzzles');
  $('train-mode-bozo-puzzles')?.classList.toggle('active', puzzleGeneralMode);
  $('train-mode-master-puzzles')?.classList.toggle('active', masterPuzzles);
  $('train-mode-recall')?.setAttribute('aria-selected', String(recall));
  $('train-mode-puzzles')?.setAttribute('aria-selected', String(trainMode === 'puzzles'));
  $('train-mode-bozo-puzzles')?.setAttribute('aria-selected', String(puzzleGeneralMode));
  $('train-mode-master-puzzles')?.setAttribute('aria-selected', String(masterPuzzles));
  if ($('train-new-line')) $('train-new-line').textContent = masterPuzzles ? 'Find another master tactic' : recall ? 'Choose another line' : puzzleGeneralMode ? 'New BOZO puzzle' : 'New puzzle line';
  const heading = document.querySelector('.train-heading');
  if (heading) {
    const eyebrow = heading.querySelector('.eyebrow'), title = heading.querySelector('h1'), copy = heading.querySelector('p');
    if (masterPuzzles) {
      if (eyebrow) eyebrow.textContent = 'MASTER GAME PUZZLES';
      if (title) title.textContent = 'Real positions. Real tactics.';
      if (copy) copy.textContent = 'Stockfish-verified tactics from imported master games.';
    } else if (puzzleGeneralMode) {
      if (eyebrow) eyebrow.textContent = 'BOZO PUZZLES';
      if (title) title.textContent = 'More than one move can work.';
      if (copy) copy.textContent = 'BOZO accepts every engine-approved line.';
    } else if (trainMode === 'puzzles') {
      if (eyebrow) eyebrow.textContent = 'OPENING PUZZLES';
      if (title) title.textContent = 'Find a good continuation.';
      if (copy) copy.textContent = 'Train published openings. Strong alternatives can branch from the book.';
    } else {
      if (eyebrow) eyebrow.textContent = 'RECALL TRAINING';
      if (title) title.textContent = 'Play it from memory.';
      if (copy) copy.textContent = 'Choose an opening. BOZO plays the replies.';
    }
  }
  if(masterPuzzles){
    puzzleOpening=null;puzzlePool=[];puzzleGame=null;
    return;
  }
  if (puzzleGeneralMode) {
    puzzleOpening = null; puzzlePool = []; puzzleGame = null;
    showBozoPuzzlePicker();
    return;
  }
  if (trainMode === 'puzzles') {
    showPuzzlePicker();
    return;
  }
  puzzleGame = null;
  prepareTrainPage();
  $('train-opening-search')?.focus();
}

$('train-mode-recall')?.addEventListener('click', () => setTrainMode('recall'));
$('train-mode-puzzles')?.addEventListener('click', () => setTrainMode('puzzles'));
$('train-mode-bozo-puzzles')?.addEventListener('click', () => setTrainMode('bozo-puzzles'));
$('train-mode-master-puzzles')?.addEventListener('click', () => setTrainMode('master-puzzles'));
$('bozo-puzzle-start')?.addEventListener('click', () => startBozoPuzzles('standard'));
$$('[data-bozo-puzzle-mode]').forEach(button => button.addEventListener('click', () => startBozoPuzzles(button.dataset.bozoPuzzleMode || 'standard')));
$$('[data-puzzle-cloud-mode]').forEach(button => button.addEventListener('click', () => loadPuzzleCloudData(button.dataset.puzzleCloudMode || 'bullet')));
$('puzzle-cloud-refresh')?.addEventListener('click', () => loadPuzzleCloudData(puzzleCloudMode));
$('puzzle-search-button')?.addEventListener('click', () => searchPuzzleOpenings($('puzzle-opening-search').value));
$('puzzle-opening-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchPuzzleOpenings(e.currentTarget.value); });
$('puzzle-opening-search')?.addEventListener('input', e => {
  clearTimeout(puzzleSearchTimer);
  puzzleSearchTimer = setTimeout(() => { if (e.currentTarget.value.trim().length >= 2) searchPuzzleOpenings(e.currentTarget.value); }, 280);
});
$('puzzle-random-button')?.addEventListener('click', startRandomOpeningPuzzles);
$('puzzle-hint')?.addEventListener('click', showPuzzleHint);
$('puzzle-answer')?.addEventListener('click', showPuzzleAnswer);
$('puzzle-skip')?.addEventListener('click', skipPuzzle);
$('puzzle-again')?.addEventListener('click', () => puzzleMasterSourceMode ? findMasterTacticalPuzzle(masterQueryValue('master-puzzle-search')) : puzzleGeneralMode ? startBozoPuzzles(puzzleRunMode) : (puzzleOpening ? startOpeningPuzzles(puzzleOpening.id) : startRandomOpeningPuzzles()));
$('puzzle-new-line')?.addEventListener('click', () => { puzzleOpening = null; puzzlePool = []; puzzleGame = null; if(puzzleMasterSourceMode){puzzleMasterSourceMode=false;setTrainMode('master-puzzles');} else puzzleGeneralMode ? showBozoPuzzlePicker() : showPuzzlePicker(); });


function showBozoPuzzlePicker() {
  if (!$('bozo-puzzle-picker')) return;
  $('bozo-puzzle-picker').hidden = false;
  $('puzzle-picker').hidden = true;
  $('puzzle-session').hidden = true;
  $('puzzle-results').hidden = true;
  loadPuzzleCloudData(puzzleCloudMode).catch(()=>{});
}

async function startBozoPuzzles(mode='standard') {
  route('train');
  trainMode = 'bozo-puzzles'; puzzleGeneralMode = true;
  puzzleRunMode = PUZZLE_RUN_CONFIG[mode] ? mode : 'standard';
  puzzleOpening = null; puzzlePool = [];
  puzzleStats = { index:0, total:puzzleRunMode==='standard'?5:Number.POSITIVE_INFINITY, score:0, streak:0, bestStreak:0, userMoves:0, firstTry:0, mistakes:0, skipped:0 };
  puzzleRunSeconds = puzzleRunConfig().seconds;
  puzzleRunDeadline = 0; puzzleRunStrikes = 3; puzzleRunHints = 3; puzzleRunHintsUsed = 0;
  puzzleRunSolved = 0; puzzleRunStartedAt = 0; puzzleCurrentStartedAt = 0; puzzleSolveTimes = []; puzzleRunOutcomes = []; puzzleRunReviewItems=[]; puzzleCurrentReviewItem=null; puzzleReviewIndex=0;
  puzzlePeakDifficulty = 0; puzzleResolutionEvals = []; puzzleFailedCurrent = false;
  puzzleUsedStarts = new Set();
  $('puzzle-picker').hidden = true; $('puzzle-results').hidden = true; $('puzzle-session').hidden = false;
  if ($('bozo-puzzle-picker')) $('bozo-puzzle-picker').hidden = true;
  puzzleCloudSetStatus();
  configurePuzzleRunUi();
  setPuzzleFeedback('neutral','Preparing your run…', puzzleRunMode==='standard' ? 'BOZO is finding a verified tactical position.' : 'The clock starts only after the first verified puzzle is ready.');
  await startNextPuzzle();
  if (isTimedPuzzleRun() && puzzleGame) startPuzzleRunClock();
}
function configurePuzzleRunUi(){
  const cfg=puzzleRunConfig(), run=isPuzzleRunMode();
  if ($('puzzle-clock-wrap')) $('puzzle-clock-wrap').hidden=!isTimedPuzzleRun();
  if ($('puzzle-strikes-wrap')) $('puzzle-strikes-wrap').hidden=!run;
  if ($('puzzle-hints-wrap')) $('puzzle-hints-wrap').hidden=!run;
  if ($('puzzle-run-grid')) $('puzzle-run-grid').hidden=!run;
  const firstTryWrap=$('puzzle-accuracy')?.closest('span'); if(firstTryWrap) firstTryWrap.hidden=run;
  if ($('puzzle-answer')) $('puzzle-answer').hidden=run;
  if ($('puzzle-skip')) $('puzzle-skip').textContent=run?'Give up puzzle':'Skip puzzle';
  if ($('puzzle-run-tip')) $('puzzle-run-tip').innerHTML=run
    ? `<b>${escapeHtml(cfg.label)}</b><br>${isTimedPuzzleRun()?`${cfg.seconds/60} minute${cfg.seconds===60?'':'s'} on the clock. `:''}Three strikes end the run. Three contextual hints are shared across the entire run.`
    : 'BOZO plays the strongest reply and keeps the tactic going until the idea is resolved.';
  updatePuzzleRunHud();
}
function startPuzzleRunClock(){
  clearInterval(puzzleRunTimer); puzzleRunStartedAt=Date.now(); puzzleRunDeadline=Date.now()+puzzleRunSeconds*1000;
  const tick=()=>{ if (!isTimedPuzzleRun()) return; const left=Math.max(0,Math.ceil((puzzleRunDeadline-Date.now())/1000));
    if ($('puzzle-clock')) $('puzzle-clock').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
    if (left<=0){ clearInterval(puzzleRunTimer); puzzleRunTimer=null; finishPuzzleSession('time'); }
  }; tick(); puzzleRunTimer=setInterval(tick,200);
}
function updatePuzzleRunHud(){
  if ($('puzzle-strikes')) $('puzzle-strikes').textContent=`${'●'.repeat(Math.max(0,puzzleRunStrikes))}${'○'.repeat(Math.max(0,3-puzzleRunStrikes))}`;
  if ($('puzzle-hints-left')) $('puzzle-hints-left').textContent=String(puzzleRunHints);
  if ($('puzzle-hint')) $('puzzle-hint').textContent=isPuzzleRunMode()?`Hint (${puzzleRunHints} left)`:'Hint';
  renderPuzzleRunGrid();
}
function renderPuzzleRunGrid(){
  const root=$('puzzle-run-grid'); if (!root || root.hidden) return;
  const cells=[]; const shown=Math.max(20,Math.min(60,puzzleRunOutcomes.length+10));
  for(let i=0;i<shown;i++){
    const outcome=puzzleRunOutcomes[i];
    const cls=outcome==='ok'?'ok':outcome==='bad'?'bad':i===puzzleRunOutcomes.length?'current':'';
    cells.push(`<span class="${cls}">${i+1}${outcome==='ok'?'✓':outcome==='bad'?'×':''}</span>`);
  }
  root.innerHTML=cells.join('');
}

function puzzlePieceValue(type) {
  return ({ p:1, n:3, b:3, r:5, q:9, k:100 })[type] || 0;
}


const PUZZLE_MOTIF_FAMILIES = {
  sacrifice:['sacrifice'],
  mate:['mate'],
  fork:['fork'],
  forcing:['forcing','combination'],
  promotion:['promotion']
};

function puzzleDesiredMotif() {
  const recent=puzzleMotifHistory.slice(-5);
  const weighted=[
    ['sacrifice',22],
    ['mate',20],
    ['fork',18],
    ['forcing',25],
    ['promotion',5],
    ['any',10]
  ];
  const adjusted=weighted.map(([key,weight])=>{
    if (key!=='any' && recent.includes(key)) weight=Math.max(4,Math.round(weight*.45));
    if (key==='sacrifice' && !recent.includes('sacrifice')) weight+=8;
    return [key,weight];
  });
  const total=adjusted.reduce((s,x)=>s+x[1],0);
  let roll=Math.random()*total;
  for (const [key,weight] of adjusted) { roll-=weight; if (roll<=0) return key; }
  return 'any';
}

function puzzleMotifMatchesTarget(motif, target='any') {
  if (!motif || target==='any') return Boolean(motif);
  return (PUZZLE_MOTIF_FAMILIES[target]||[target]).includes(motif.key);
}

function puzzleRecordMotif(motif) {
  if (!motif?.key) return;
  const family=motif.key==='combination'?'forcing':motif.key;
  puzzleMotifHistory.push(family);
  if (puzzleMotifHistory.length>12) puzzleMotifHistory.shift();
}

function puzzleMoveSetupWeight(game, move, ply, targetMotif='any') {
  let weight=10;
  const piece=game.get(move.from);
  const fromRank=Number(move.from[1]);
  const toRank=Number(move.to[1]);
  const captureValue=puzzlePieceValue(move.captured);

  if (/O-O/.test(move.san)) weight+=16;
  if (piece?.type==='p' && ['d','e'].includes(move.from[0]) && ply<10) weight+=10;
  if ((piece?.type==='n'||piece?.type==='b') && ((piece.color==='w'&&fromRank===1)||(piece.color==='b'&&fromRank===8)) && ply<16) weight+=10;
  if (piece?.type==='q' && ply<10) weight*=.18;
  if (piece?.type==='k' && !/O-O/.test(move.san) && ply<18) weight*=.06;
  if (piece?.type==='r' && ply<10) weight*=.30;

  if (move.captured) {
    if (targetMotif==='sacrifice' || targetMotif==='mate') {
      weight += 2 + captureValue*.7;
      if (captureValue>=5) weight*=.45;
    } else {
      weight += 6 + captureValue*1.35;
    }
  }
  if (/[+#]/.test(move.san)) {
    weight += targetMotif==='mate' ? 10 : targetMotif==='sacrifice' ? 5 : 7;
  }
  if (move.promotion) weight+=18;

  if (ply>=12 && ['b','n','r','q'].includes(piece?.type)) {
    weight += (targetMotif==='sacrifice'||targetMotif==='fork') ? 4 : 2;
  }
  if (piece?.type==='p' && Math.abs(toRank-fromRank)===2 && ply<12) weight+=3;
  return Math.max(.1,weight);
}

function weightedPuzzleMoveChoice(game, legal, ply, targetMotif='any') {
  const scoreMove = move => puzzleMoveSetupWeight(game,move,ply,targetMotif);
  const weights=legal.map(scoreMove); const total=weights.reduce((a,b)=>a+b,0);
  let roll=Math.random()*total;
  for (let i=0;i<legal.length;i++) { roll-=weights[i]; if (roll<=0) return legal[i]; }
  return legal[legal.length-1];
}

function puzzleFenState(fen='') {
  const fields = String(fen || '').trim().split(/\s+/);
  return {
    placement: fields[0] || '',
    turn: fields[1] || 'w',
    castling: fields[2] || '-',
    enPassant: fields[3] || '-',
    halfmove: Number(fields[4] || 0),
    fullmove: Number(fields[5] || 1)
  };
}

function puzzleHasAmbiguousCastlingState(game) {
  const state = puzzleFenState(game.fen());
  const rights = state.castling === '-' ? '' : state.castling;

  const homePairWithoutRight = (color, kingSquare, rookSquare, right) => {
    const king = game.get(kingSquare);
    const rook = game.get(rookSquare);
    return Boolean(
      king?.color === color && king?.type === 'k' &&
      rook?.color === color && rook?.type === 'r' &&
      !rights.includes(right)
    );
  };

  return (
    homePairWithoutRight('w','e1','h1','K') ||
    homePairWithoutRight('w','e1','a1','Q') ||
    homePairWithoutRight('b','e8','h8','k') ||
    homePairWithoutRight('b','e8','a8','q')
  );
}

function puzzleFenRoundTripsExactly(fen='') {
  try {
    const original = puzzleFenState(fen);
    const clone = new Chess(fen);
    const loaded = puzzleFenState(clone.fen());
    return (
      original.placement === loaded.placement &&
      original.turn === loaded.turn &&
      original.castling === loaded.castling &&
      original.enPassant === loaded.enPassant &&
      original.halfmove === loaded.halfmove &&
      original.fullmove === loaded.fullmove
    );
  } catch {
    return false;
  }
}

function generateBozoPosition(targetMotif='any') {
  // Reach a natural-looking legal position through weighted play. Target profiles
  // preserve the kinds of structures where the requested motif can actually exist;
  // Stockfish still decides whether the final position is a valid puzzle.
  for (let attempt=0; attempt<50; attempt++) {
    const game = new Chess();
    const minPly=(targetMotif==='sacrifice'||targetMotif==='mate')?20:16;
    const spread=(targetMotif==='sacrifice'||targetMotif==='mate')?26:24;
    const target = minPly + Math.floor(Math.random()*spread);
    const history = [];
    for (let ply=0; ply<target && !game.game_over(); ply++) {
      const legal = game.moves({verbose:true});
      if (!legal.length) break;
      const chosen = weightedPuzzleMoveChoice(game, legal, ply, targetMotif);
      game.move(chosen.san);
      history.push(chosen.san);
    }
    if (game.game_over()) continue;

    const fen = game.fen();

    // Keep the authoritative full FEN. If the board looks castle-ready only because
    // a king/rook moved away and later returned home, discard that generated puzzle
    // rather than inventing a castling right that history has correctly removed.
    if (!puzzleFenRoundTripsExactly(fen)) continue;
    if (puzzleHasAmbiguousCastlingState(game)) continue;

    const pieces = game.board().flat().filter(Boolean);
    const nonKings = pieces.filter(p => p.type !== 'k').length;
    const whitePieces = pieces.filter(p=>p.color==='w' && p.type!=='k');
    const blackPieces = pieces.filter(p=>p.color==='b' && p.type!=='k');
    const whiteMaterial = whitePieces.reduce((s,p)=>s+puzzlePieceValue(p.type),0);
    const blackMaterial = blackPieces.reduce((s,p)=>s+puzzlePieceValue(p.type),0);
    const whiteNonPawns = whitePieces.filter(p=>p.type!=='p').length;
    const blackNonPawns = blackPieces.filter(p=>p.type!=='p').length;

    // v4.11.7: generated-position sanity gate. The previous ±8 material
    // allowance let random playouts drift into already-lost, puzzle-like-looking
    // positions. Tactical puzzles should BEGIN from a credible competitive
    // position; the tactic itself may create a large swing afterwards.
    if (nonKings < PUZZLE_MIN_NONKING_PIECES) continue;
    if (Math.abs(whiteMaterial-blackMaterial) > PUZZLE_MAX_ROOT_MATERIAL_IMBALANCE) continue;
    if (whiteMaterial < PUZZLE_MIN_SIDE_MATERIAL || blackMaterial < PUZZLE_MIN_SIDE_MATERIAL) continue;
    if (whitePieces.length < PUZZLE_MIN_SIDE_PIECES || blackPieces.length < PUZZLE_MIN_SIDE_PIECES) continue;
    if (whiteNonPawns < PUZZLE_MIN_SIDE_NONPAWN_PIECES || blackNonPawns < PUZZLE_MIN_SIDE_NONPAWN_PIECES) continue;

    return {
      fen: fen,
      history: history,
      userSide: game.turn()==='b' ? 'black' : 'white',
      fenState: puzzleFenState(fen)
    };
  }
  return null;
}

function puzzleMoveFromUci(game, uci) {
  if (!uci || uci.length < 4) return null;
  const clone = new Chess(game.fen());
  return clone.move({ from:uci.slice(0,2), to:uci.slice(2,4), promotion:uci[4] || 'q' });
}

function puzzleAttacksFrom(game, from, piece) {
  const files='abcdefgh'; const f=files.indexOf(from[0]); const r=Number(from[1]); const out=[];
  const add=(ff,rr)=>{ if(ff>=0&&ff<8&&rr>=1&&rr<=8) out.push(`${files[ff]}${rr}`); };
  if (!piece) return out;
  if (piece.type==='p') { const dr=piece.color==='w'?1:-1; add(f-1,r+dr); add(f+1,r+dr); return out; }
  if (piece.type==='n') { [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([df,dr])=>add(f+df,r+dr)); return out; }
  if (piece.type==='k') { for(let df=-1;df<=1;df++)for(let dr=-1;dr<=1;dr++)if(df||dr)add(f+df,r+dr); return out; }
  const dirs=piece.type==='b'?[[1,1],[1,-1],[-1,1],[-1,-1]]:piece.type==='r'?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  for(const [df,dr] of dirs){ let ff=f+df,rr=r+dr; while(ff>=0&&ff<8&&rr>=1&&rr<=8){ const sq=`${files[ff]}${rr}`; out.push(sq); if(game.get(sq)) break; ff+=df;rr+=dr; } }
  return out;
}

function puzzleMaterialTotal(game) {
  return game.board().flat().filter(Boolean).reduce((s,p)=>s+(p.type==='k'?0:puzzlePieceValue(p.type)),0);
}

function puzzleSideMaterial(game, color) {
  return game.board().flat().filter(p=>p && p.color===color && p.type!=='k')
    .reduce((sum,p)=>sum+puzzlePieceValue(p.type),0);
}

function puzzleMaterialBalance(game, color) {
  const enemy=color==='w'?'b':'w';
  return puzzleSideMaterial(game,color)-puzzleSideMaterial(game,enemy);
}

function puzzleRootPositionSanity(fen='') {
  try {
    const game=new Chess(fen);
    const pieces=game.board().flat().filter(Boolean);
    const byColor=color=>pieces.filter(p=>p.color===color && p.type!=='k');
    const w=byColor('w'), b=byColor('b');
    const wm=w.reduce((sum,p)=>sum+puzzlePieceValue(p.type),0);
    const bm=b.reduce((sum,p)=>sum+puzzlePieceValue(p.type),0);
    const wnp=w.filter(p=>p.type!=='p').length, bnp=b.filter(p=>p.type!=='p').length;
    if (Math.abs(wm-bm)>PUZZLE_MAX_ROOT_MATERIAL_IMBALANCE) return {ok:false,reason:'material-imbalance',white:wm,black:bm};
    if (wm<PUZZLE_MIN_SIDE_MATERIAL || bm<PUZZLE_MIN_SIDE_MATERIAL) return {ok:false,reason:'too-reduced',white:wm,black:bm};
    if (w.length<PUZZLE_MIN_SIDE_PIECES || b.length<PUZZLE_MIN_SIDE_PIECES) return {ok:false,reason:'piece-count',whitePieces:w.length,blackPieces:b.length};
    if (wnp<PUZZLE_MIN_SIDE_NONPAWN_PIECES || bnp<PUZZLE_MIN_SIDE_NONPAWN_PIECES) return {ok:false,reason:'nonpawn-count',whiteNonPawns:wnp,blackNonPawns:bnp};
    return {ok:true,white:wm,black:bm};
  } catch { return {ok:false,reason:'invalid-fen'}; }
}

function puzzleSquareAttackers(game, square, color) {
  const found=[];
  for (const rank of [1,2,3,4,5,6,7,8]) for (const file of 'abcdefgh') {
    const from=`${file}${rank}`, piece=game.get(from);
    if (!piece || piece.color!==color) continue;
    if (puzzleAttacksFrom(game,from,piece).includes(square)) found.push({from,piece});
  }
  return found;
}

// Reject generated positions whose "tactic" is polluted by any trivial
// one-move material pickup. This applies to every non-king piece, not just
// queens and rooks. A BOZO puzzle should test a concrete tactical idea, not
// whether the player notices an undefended pawn/minor/rook/queen.
//
// We inspect LEGAL captures in the root position and the opponent's LEGAL
// immediate recaptures on the capture square. If the side to move can simply
// gain material after the obvious exchange, the generated position is thrown
// away before motif detection. This catches free pieces as well as favorable
// "capture and get recaptured" exchanges such as rook-for-queen.
function puzzleHasTrivialMaterialCapture(fen) {
  const game=new Chess(fen);
  const side=game.turn();
  let legal=[];
  try { legal=game.moves({verbose:true})||[]; } catch (_) { return null; }

  for (const move of legal) {
    if (!move?.captured || move.captured==='k') continue;
    const mover=game.get(move.from);
    const moverValue=puzzlePieceValue(mover?.type);
    const capturedValue=puzzlePieceValue(move.captured);
    if (!capturedValue) continue;

    const after=new Chess(fen);
    let played=null;
    try { played=after.move({from:move.from,to:move.to,promotion:move.promotion||'q'}); }
    catch (_) { played=null; }
    if (!played) continue;

    let replies=[];
    try { replies=after.moves({verbose:true})||[]; } catch (_) { replies=[]; }
    const recaptures=replies.filter(reply=>reply.to===move.to && Boolean(reply.captured));

    // If an immediate recapture exists, assume the capturing piece can be lost
    // and score the basic exchange accordingly. If there are several recaptures,
    // the material result of the immediate exchange is the same for this sanity
    // gate because they all remove the capturing piece from the destination.
    const canRecapture=recaptures.length>0;
    const immediateNetGain=capturedValue-(canRecapture?moverValue:0);

    // Any clean positive material pickup is too trivial for a generated tactical
    // puzzle. Examples: free pawn (+1), free knight/bishop (+3), free rook (+5),
    // free queen (+9), or rook-takes-queen-and-is-recaptured (+4).
    // Equal/negative exchanges are left for the deeper engine/motif gate.
    if (immediateNetGain>=1) {
      return {
        side,
        uci:`${move.from}${move.to}${move.promotion||''}`,
        san:move.san||'',
        captured:move.captured,
        mover:mover?.type||'',
        moverValue,
        capturedValue,
        canRecapture,
        immediateNetGain
      };
    }
  }
  return null;
}

function inspectPuzzlePv(fen, line, maxPlies=8) {
  const game=new Chess(fen), rootColor=game.turn();
  const startBalance=puzzleMaterialBalance(game,rootColor);
  let minBalance=startBalance,maxBalance=startBalance,minBalancePly=-1,maxBalancePly=-1;
  const moves=[];
  let checks=0,captures=0,promotions=0;
  for (const uci of (line?.pv||[]).slice(0,maxPlies)) {
    const before=new Chess(game.fen());
    const mover=before.get(uci.slice(0,2));
    const victim=before.get(uci.slice(2,4));
    const move=puzzleMoveFromUci(before,uci);
    if (!move) break;
    const rec={uci,san:move.san,mover:mover?.type||'',moverValue:puzzlePieceValue(mover?.type),captured:victim?.type||move.captured||'',capturedValue:puzzlePieceValue(victim?.type||move.captured),from:uci.slice(0,2),to:uci.slice(2,4),ply:moves.length};
    if (/[+#]/.test(move.san)) checks++;
    if (move.captured) captures++;
    if (move.promotion) promotions++;
    game.move({from:rec.from,to:rec.to,promotion:uci[4]||'q'});
    rec.balanceAfter=puzzleMaterialBalance(game,rootColor);
    if (rec.balanceAfter<minBalance){ minBalance=rec.balanceAfter; minBalancePly=moves.length; }
    if (rec.balanceAfter>maxBalance){ maxBalance=rec.balanceAfter; maxBalancePly=moves.length; }
    moves.push(rec);
    if (game.game_over()) break;
  }
  const endBalance=puzzleMaterialBalance(game,rootColor);
  return {
    rootColor,startBalance,endBalance,materialSwing:endBalance-startBalance,
    minBalance,maxBalance,minBalancePly,maxBalancePly,
    materialInvestment:Math.max(0,startBalance-minBalance),
    materialRecovery:Math.max(0,endBalance-minBalance),
    moves,checks,captures,promotions,game,
    endedInMate:Boolean(game.in_checkmate?.())
  };
}

function detectPuzzleTacticalMotif(fen, line, maxPlies=16) {
  if (!line?.pv?.[0]) return null;
  const root=new Chess(fen), rootColor=root.turn();
  const firstUci=line.pv[0], first=puzzleMoveFromUci(root,firstUci);
  if (!first) return null;
  const movingPiece=root.get(firstUci.slice(0,2));
  const capturedPiece=root.get(firstUci.slice(2,4));
  const movedValue=puzzlePieceValue(movingPiece?.type), capturedValue=puzzlePieceValue(capturedPiece?.type);
  const pv=inspectPuzzlePv(fen,line,maxPlies);

  const rootMate=Number.isFinite(Number(line.mate)) && Number(line.mate)>0;
  if (/#/.test(first.san) || pv.endedInMate || rootMate) {
    if (pv.materialInvestment>=PUZZLE_SACRIFICE_MIN_INVESTMENT)
      return {key:'sacrifice',subtype:'mate',label:'Sacrifice for mate',confidence:'verified'};
    return {key:'mate',label:'Mating tactic',confidence:'verified'};
  }
  if (first.promotion || pv.promotions) return {key:'promotion',label:'Promotion tactic',confidence:'verified'};

  const enemy=rootColor==='w'?'b':'w';
  const firstTargetDefenders=capturedPiece ? puzzleSquareAttackers(root,firstUci.slice(2,4),enemy).length : 0;
  const plainLoosePickup=Boolean(capturedPiece && capturedValue>=1 && firstTargetDefenders===0 && pv.checks===0 && pv.captures<=1);

  const afterFirst=new Chess(fen);
  afterFirst.move({from:firstUci.slice(0,2),to:firstUci.slice(2,4),promotion:firstUci[4]||'q'});
  const movedAfter=afterFirst.get(firstUci.slice(2,4));
  const targets=puzzleAttacksFrom(afterFirst,firstUci.slice(2,4),movedAfter)
    .map(sq=>({sq,p:afterFirst.get(sq)}))
    .filter(x=>x.p && x.p.color===enemy && x.p.type!=='p');
  const valuable=targets.filter(x=>puzzlePieceValue(x.p.type)>=3);
  const kingHit=valuable.some(x=>x.p.type==='k');
  const piecesHit=valuable.filter(x=>x.p.type!=='k');

  const offeredImmediate = pv.moves[1]?.to===firstUci.slice(2,4) && pv.moves[1]?.capturedValue===movedValue;

  // Do not call a normal forcing exchange a sacrifice.
  // Example: Be6+ Nxe6 dxe6. The bishop is "offered", but White immediately
  // recaptures the knight and restores the material balance. That is a trade,
  // not a sacrifice.
  const immediateRootRecapture = Boolean(
    offeredImmediate &&
    pv.moves[2] &&
    pv.moves[2].to===firstUci.slice(2,4) &&
    pv.moves[2].capturedValue>0 &&
    pv.moves[2].balanceAfter>=pv.startBalance-0.5
  );

  const meaningfulInvestment = pv.materialInvestment>=PUZZLE_SACRIFICE_MIN_INVESTMENT;
  const recoveredInvestment = pv.materialRecovery>=PUZZLE_SACRIFICE_MIN_RECOVERY;
  const finishesAhead = pv.endBalance>=pv.startBalance+1;
  const forcingCompensation = pv.checks>=2 || pv.captures>=3;
  const sacrificeInvestmentPersists = meaningfulInvestment && !immediateRootRecapture;

  if (sacrificeInvestmentPersists && (recoveredInvestment || finishesAhead || forcingCompensation)) {
    const firstThree=pv.moves.slice(0,3);
    const rookOffered=(movingPiece?.type==='r' && offeredImmediate);
    const rookLost=firstThree.some((m,idx)=>idx%2===1 && m.captured==='r');
    const minorOrPawnReturn=firstThree.some((m,idx)=>idx%2===0 && ['p','n','b'].includes(m.captured));
    if ((rookOffered||rookLost) && (minorOrPawnReturn || pv.endBalance>=pv.startBalance-1))
      return {key:'sacrifice',subtype:'exchange',label:'Exchange sacrifice',confidence:'verified'};
    if (offeredImmediate || movedValue>=3)
      return {key:'sacrifice',subtype:'calculated',label:'Calculated sacrifice',confidence:'verified'};
    return {key:'sacrifice',subtype:'material',label:'Material sacrifice',confidence:'verified'};
  }

  if (!immediateRootRecapture && capturedPiece && movedValue>capturedValue+1 && pv.captures>=3 &&
      (pv.materialSwing>=-1 || pv.checks>=2 || recoveredInvestment))
    return {key:'sacrifice',subtype:'material',label:'Material sacrifice',confidence:'verified'};

  if ((piecesHit.length>=2 || (kingHit && piecesHit.length>=1)) &&
      (pv.captures>=1 || pv.materialSwing>=2 || pv.checks>=2))
    return {key:'fork',label:'Fork / double attack',confidence:'verified'};

  if (pv.checks>=2 && (pv.captures>=1 || pv.checks>=3) && pv.moves.length>=3)
    return {key:'forcing',label:'Forcing tactical sequence',confidence:'verified'};

  if (!plainLoosePickup && pv.captures>=3 && pv.moves.length>=4 && Math.abs(pv.materialSwing)>=2)
    return {key:'combination',label:'Multi-move combination',confidence:'verified'};

  return null;
}

function puzzleTacticalGap(lines) {
  if (!lines?.length) return 0;
  const best=puzzleEngineScore(lines[0]);
  const second=lines[1] ? puzzleEngineScore(lines[1]) : best;
  return Math.max(0,best-second);
}

async function verifyGeneralPuzzleCandidate(spec, initialLines, targetMotif='any') {
  if (!initialLines?.length) return null;
  const rootSanity=puzzleRootPositionSanity(spec.fen);
  if (!rootSanity.ok) {
    console.debug('Puzzle candidate rejected: unnatural root material state', rootSanity);
    return null;
  }
  const trivialPickup=puzzleHasTrivialMaterialCapture(spec.fen);
  if (trivialPickup) {
    console.debug('Puzzle candidate rejected: trivial material pickup', trivialPickup);
    return null;
  }
  const initialMotif=detectPuzzleTacticalMotif(spec.fen,initialLines[0], targetMotif==='sacrifice'?18:14);
  if (!puzzleMotifMatchesTarget(initialMotif,targetMotif)) return null;
  if (!initialMotif) return null;
  const initialScore=puzzleEngineScore(initialLines[0]);
  // Avoid positions that are already absurdly won by material unless the puzzle is
  // mate/promotion; these tend to teach cleanup rather than a real decision.
  if (Math.abs(initialScore)>PUZZLE_MAX_QUIET_EVAL && !['mate','promotion'].includes(initialMotif.key)) return null;

  const engine=await getReviewEngine();
  const verifyDepth=targetMotif==='sacrifice'?PUZZLE_SACRIFICE_VERIFY_DEPTH:PUZZLE_VERIFY_DEPTH;
  const verified=await engine.analyzeMultiPv(spec.fen,verifyDepth,6);
  if (!verified.length) return null;
  const motif=detectPuzzleTacticalMotif(spec.fen,verified[0], targetMotif==='sacrifice'?20:16);
  if (!motif || motif.key!==initialMotif.key || !puzzleMotifMatchesTarget(motif,targetMotif)) return null;
  // BOZO puzzle modes should test a concrete tactical idea, not ask the player to
  // guess a quiet engine simplification. Transitional/cleanup positions are never
  // admitted as standalone puzzles.
  if (motif.key==='transition') return null;
  const pv=inspectPuzzlePv(spec.fen,verified[0], targetMotif==='sacrifice'?20:16);
  const gap=puzzleTacticalGap(verified);
  const first=pv.moves?.[0];
  const concreteFirst=Boolean(first && (first.captured || /[+#]/.test(first.san||'') || first.san?.includes('=') || ['fork','sacrifice','mate','promotion'].includes(motif.key)));
  if (isPuzzleRunMode() && !concreteFirst) return null;
  // For forcing/combination positions, the first move must matter clearly and the
  // deeper line must show a forcing payoff.
  if (['forcing','combination'].includes(motif.key) && (gap<PUZZLE_MIN_TACTICAL_GAP || (!concreteFirst && pv.checks<2 && pv.captures<3))) return null;
  if (!['mate','promotion','sacrifice','fork'].includes(motif.key) && gap<PUZZLE_MIN_TACTICAL_GAP && pv.checks<2 && pv.captures<3) return null;
  return {lines:verified,motif,pv,gap};
}

async function buildGeneralPuzzle() {
  // v4.11.6: motif-targeted generation. BOZO deliberately requests a tactical
  // family, then verifies that Stockfish's best line really contains that motif.
  // Rare targets gracefully fall back to another verified tactic rather than
  // making the player wait indefinitely.
  const desired=puzzleDesiredMotif();
  const maxAttempts=desired==='any'?PUZZLE_MAX_GENERATION_ATTEMPTS:PUZZLE_TARGETED_GENERATION_ATTEMPTS;
  let bestFallback=null;

  for (let attempt=0; attempt<maxAttempts; attempt++) {
    const activeTarget=(desired!=='any' && attempt<Math.ceil(maxAttempts*.55)) ? desired : 'any';
    const spec=generateBozoPosition(desired);
    if (!spec) continue;
    puzzleGame=new Chess(spec.fen); puzzleUserSide=spec.userSide;
    puzzleCandidateFen=''; puzzleCandidateMoves=[];
    try {
      const engine=await getReviewEngine();
      const discoveryDepth=desired==='sacrifice'?Math.max(PUZZLE_GENERATION_DEPTH,14):PUZZLE_GENERATION_DEPTH;
      const discovery=await engine.analyzeMultiPv(spec.fen,discoveryDepth,6);
      const quality=await verifyGeneralPuzzleCandidate(spec,discovery,activeTarget);
      if (!quality) continue;

      const bestScore=puzzleEngineScore(quality.lines[0]);
      const candidates=quality.lines.filter(line=>line.pv?.[0]).map(line=>({
        ...line,uci:line.pv[0],loss:Math.max(0,bestScore-puzzleEngineScore(line))
      })).filter((line,index)=>index===0 || line.loss<=PUZZLE_PLAYABLE_CP_WINDOW);

      const solutionPv=(quality.lines[0]?.pv||[]).slice(0,24);
      const inspected=inspectPuzzlePv(spec.fen,quality.lines[0],24);
      const mateLine=quality.motif.key==='mate' || quality.motif.subtype==='mate' || inspected.endedInMate;
      const maxUserMoves=quality.motif.key==='sacrifice'?7:mateLine?8:5;
      const targetUserMoves=Math.max(2,Math.min(maxUserMoves,Math.ceil(solutionPv.length/2)));
      const result={
        ...spec,candidates,motif:quality.motif,solutionPv,targetUserMoves,
        quality:{gap:quality.gap,depth:desired==='sacrifice'?PUZZLE_SACRIFICE_VERIFY_DEPTH:PUZZLE_VERIFY_DEPTH,fenStateVerified:true,targetMotif:desired}
      };

      if (!bestFallback) bestFallback=result;
      if (puzzleMotifMatchesTarget(quality.motif,desired) ||
          candidates.length>=2 || ['sacrifice','fork','mate','promotion'].includes(quality.motif.key)) {
        puzzleRecordMotif(quality.motif);
        return result;
      }
      bestFallback=result;
    } catch(error) {
      console.warn('Puzzle candidate rejected by quality gate.',error);
    }
  }

  if (bestFallback) puzzleRecordMotif(bestFallback.motif);
  return bestFallback;
}

function showPuzzlePicker() {
  if (!$('puzzle-picker')) return;
  if ($('bozo-puzzle-picker')) $('bozo-puzzle-picker').hidden = true;
  $('puzzle-picker').hidden = false;
  $('puzzle-session').hidden = true;
  $('puzzle-results').hidden = true;
}

async function searchPuzzleOpenings(query = '') {
  const root = $('puzzle-opening-results');
  if (!root) return;
  const text = query.trim();
  root.innerHTML = '<div class="empty-state"><div>⌛</div><b>Building puzzles…</b></div>';
  let req = sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('status','published').limit(60);
  if (text) req = req.or(`name.ilike.%${text}%,variation.ilike.%${text}%,eco.ilike.%${text}%`);
  const { data, error } = await req.order('name');
  if (error) { root.innerHTML = `<div class="empty-state"><div>⚠</div><b>Could not load openings</b><span>${escapeHtml(readableError(error))}</span></div>`; return; }
  const rows = (data || []).filter(openingSupportsPuzzles);
  if (!rows.length) { root.innerHTML = '<div class="empty-state"><div>🧩</div><b>No puzzle-ready lines</b><span>Try a broader opening name.</span></div>'; return; }
  root.innerHTML = rows.slice(0,40).map(row => {
    const side = inferOpeningSide(row);
    return `<button class="train-opening-result puzzle-opening-result" type="button" data-puzzle-opening="${row.id}"><span><b>${escapeHtml(row.name)}</b><small>${escapeHtml(row.variation || 'Main Line')} · ${escapeHtml(row.eco || 'ECO  - ')}</small></span><em>5 puzzles · ${side === 'neutral' ? 'White' : side}</em></button>`;
  }).join('');
  root.querySelectorAll('[data-puzzle-opening]').forEach(button => button.addEventListener('click', () => startOpeningPuzzles(button.dataset.puzzleOpening)));
}

function openingSupportsPuzzles(row) {
  if (!row?.pgn) return false;
  try {
    const game = new Chess();
    if (!game.load_pgn(row.pgn, { sloppy:true })) return false;
    return game.history().length >= 3;
  } catch { return false; }
}

async function fetchPuzzleOpening(openingId) {
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('id',openingId).maybeSingle();
  if (error || !data) throw error || new Error('Opening not found');
  return data;
}

async function startOpeningPuzzles(openingId) {
  route('train');
  setTrainMode('puzzles');
  try {
    puzzleOpening = await fetchPuzzleOpening(openingId);
    puzzlePool = [puzzleOpening];
    beginPuzzleSession();
  } catch (error) { toast(readableError(error)); }
}
window.startOpeningPuzzles = startOpeningPuzzles;

async function startRandomOpeningPuzzles() {
  route('train');
  setTrainMode('puzzles');
  const root = $('puzzle-opening-results');
  if (root) root.innerHTML = '<div class="empty-state"><div>🎲</div><b>BOZO is shuffling the library…</b><span>Finding five puzzle-ready positions.</span></div>';
  const { data, error } = await sb.from('openings').select('id,eco,name,variation,pgn,notes,metadata,source_type,recommended_min_elo,recommended_max_elo,elo_reviewed,elo_updated_at').eq('status','published').limit(120);
  if (error) { showPuzzlePicker(); return toast(readableError(error)); }
  puzzleOpening = null;
  puzzlePool = shuffleArray((data || []).filter(openingSupportsPuzzles)).slice(0,25);
  if (!puzzlePool.length) { showPuzzlePicker(); return toast('No puzzle-ready opening lines were found.'); }
  beginPuzzleSession();
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
  return copy;
}

function beginPuzzleSession() {
  if ($('bozo-puzzle-picker')) $('bozo-puzzle-picker').hidden = true;
  puzzleStats = { index:0, total:5, score:0, streak:0, bestStreak:0, userMoves:0, firstTry:0, mistakes:0, skipped:0 };
  puzzleUsedStarts = new Set();
  $('puzzle-picker').hidden = true;
  $('puzzle-results').hidden = true;
  $('puzzle-session').hidden = false;
  startNextPuzzle();
}

function choosePuzzleOpening() {
  if (puzzleOpening) return puzzleOpening;
  if (!puzzlePool.length) return null;
  return puzzlePool[puzzleStats.index % puzzlePool.length] || puzzlePool[Math.floor(Math.random()*puzzlePool.length)];
}

function buildPuzzleForOpening(opening) {
  const parser = new Chess();
  if (!parser.load_pgn(opening.pgn, { sloppy:true })) return null;
  const moves = parser.history();
  const inferred = inferOpeningSide(opening);
  const userSide = inferred === 'black' ? 'black' : 'white';
  const parity = userSide === 'white' ? 0 : 1;
  let candidates = moves.map((_,i)=>i).filter(i => i%2===parity && i < moves.length);
  const midCandidates = candidates.filter(i => i >= 4);
  if (midCandidates.length) candidates = midCandidates;
  if (!candidates.length) return null;
  const unused = candidates.filter(i => !puzzleUsedStarts.has(`${opening.id}:${i}`));
  const pool = unused.length ? unused : candidates;
  const startPly = pool[Math.floor(Math.random()*pool.length)];
  puzzleUsedStarts.add(`${opening.id}:${startPly}`);
  const remainingUserMoves = candidates.filter(i => i >= startPly).length;
  const maxTarget = Math.max(1, Math.min(3, remainingUserMoves));
  const targetUserMoves = 1 + Math.floor(Math.random()*maxTarget);
  return { opening, moves, userSide, startPly, targetUserMoves };
}

async function startNextPuzzle() {
  puzzleCompleting = false;
  if (puzzleStats.index >= puzzleStats.total) return finishPuzzleSession();

  if (puzzleGeneralMode) {
    setPuzzleFeedback('neutral','Generating a position…','BOZO is looking for a position with meaningful choices.');
    const spec = await buildGeneralPuzzle();
    if (!spec) {
      setPuzzleFeedback('wrong','No tactical position found.','BOZO could not find a concrete tactical puzzle this time. Try generating another set.');
      return setTimeout(() => completeCurrentPuzzle(true, true), 700);
    }
    puzzleGame = new Chess(spec.fen);
    puzzleGeneralFen = spec.fen; puzzleGeneralHistory = spec.history;
    puzzleUserSide = spec.userSide; puzzleMoves = []; puzzleStartPly = 0; puzzlePly = 0;
    puzzleTargetUserMoves = spec.targetUserMoves || 4; puzzleSolvedInCurrent = 0; puzzleSelectedSquare = null;
    puzzleCurrentDifficulty = 0; puzzlePeakDifficulty=0; puzzleResolutionEvals=[]; puzzleFailedCurrent=false; puzzleCurrentStartedAt=Date.now();
    puzzleAttemptsForPly = 0; puzzleHintUsed = false; puzzleAnswerUsed = false;
    puzzleCandidateFen = spec.fen; puzzleCandidateMoves = spec.candidates || [];
    puzzleGeneralMotif = spec.motif?.label || 'Tactical sequence';
    puzzleCurrentReviewItem={fen:spec.fen,side:puzzleUserSide,motif:puzzleGeneralMotif,solutionPv:[...(spec.solutionPv||[])],result:'pending',attemptedMove:null,attempts:[],playedLine:[],hintUsed:false};
    puzzleCurrentOpening = null;
    $('puzzle-title').textContent = 'What would you play?';
    // Do not reveal the generated motif before the player solves the position.
    $('puzzle-subtitle').textContent = `${puzzleUserSide[0].toUpperCase()+puzzleUserSide.slice(1)} to move`;
    $('puzzle-number').textContent = isPuzzleRunMode() ? `${puzzleStats.index+1}` : `${puzzleStats.index+1}/${puzzleStats.total}`;
    $('puzzle-start-label').textContent = 'generated position';
    setPuzzleFeedback('neutral','Find the tactical idea.', puzzleCandidateMoves.length > 1 ? `BOZO sees ${puzzleCandidateMoves.length} promising paths, but any legal move you choose will be evaluated on its own merits.` : 'Find the concrete continuation. Any legal move you choose will be evaluated on its own merits.');
    paintPuzzleBoard(); updatePuzzleUI(); return;
  }

  let spec = null;
  for (let tries=0; tries<Math.max(4,puzzlePool.length); tries++) {
    const opening = puzzleOpening || puzzlePool[(puzzleStats.index + tries) % puzzlePool.length];
    spec = buildPuzzleForOpening(opening);
    if (spec) break;
  }
  if (!spec) return finishPuzzleSession();
  puzzleMoves = spec.moves; puzzleUserSide = spec.userSide; puzzleStartPly = spec.startPly; puzzlePly = spec.startPly;
  puzzleTargetUserMoves = spec.targetUserMoves; puzzleSolvedInCurrent = 0; puzzleSelectedSquare = null;
  puzzleAttemptsForPly = 0; puzzleHintUsed = false; puzzleAnswerUsed = false; puzzleCandidateMoves = []; puzzleCandidateFen = '';
  puzzleGame = new Chess(); for (let i=0;i<puzzleStartPly;i++) puzzleGame.move(puzzleMoves[i], { sloppy:true });
  if (!puzzleGeneralMode) puzzleCurrentReviewItem={fen:puzzleGame.fen(),side:puzzleUserSide,motif:'Opening puzzle',solutionPv:[],result:'pending',attemptedMove:null,attempts:[],playedLine:[],hintUsed:false};
  puzzleCurrentOpening = spec.opening;
  $('puzzle-title').textContent = 'Choose your path.';
  $('puzzle-subtitle').textContent = `${spec.opening.name}${spec.opening.variation ? ' · '+spec.opening.variation : ''} · ${spec.opening.eco || 'ECO  - '}`;
  $('puzzle-number').textContent = `${puzzleStats.index+1}/${puzzleStats.total}`;
  $('puzzle-start-label').textContent = puzzleStartPly ? `move ${Math.floor(puzzleStartPly/2)+1}` : 'the opening position';
  setPuzzleFeedback('neutral','Your move.', puzzleTargetUserMoves === 1 ? 'Find a strong continuation. More than one move may be right.' : `Find ${puzzleTargetUserMoves} strong continuation moves. Your choices can branch.`);
  await advancePuzzleOpponentMoves(); paintPuzzleBoard(); updatePuzzleUI();
  if (puzzleGame && isPuzzleUserTurn()) loadPuzzleCandidates();
}
let puzzleCurrentOpening = null;

function puzzleSideToMove() { return puzzleGame?.turn() === 'b' ? 'black' : 'white'; }
function isPuzzleUserTurn() { return puzzleSideToMove() === puzzleUserSide; }

async function loadPuzzleCandidates() {
  if (!puzzleGame || !isPuzzleUserTurn()) return [];
  const fen = puzzleGame.fen();
  if (puzzleCandidateFen === fen && puzzleCandidateMoves.length) return puzzleCandidateMoves;
  puzzleCandidateFen = fen;
  puzzleCandidateMoves = [];
  try {
    const engine = await getReviewEngine();
    const lines = await engine.analyzeMultiPv(fen, PUZZLE_BRANCH_DEPTH, 5);
    if (!lines.length) return [];
    const score = line => line.mate !== null
      ? (line.mate > 0 ? 100000 - Math.abs(line.mate) * 100 : -100000 + Math.abs(line.mate) * 100)
      : Number(line.cp ?? -100000);
    const bestScore = score(lines[0]);
    if (puzzleGeneralMode && Number.isFinite(bestScore) && Math.abs(bestScore)<90000) { puzzleResolutionEvals.push(bestScore); if (puzzleResolutionEvals.length>4) puzzleResolutionEvals.shift(); }
    puzzleCandidateMoves = lines
      .filter(line => line.pv?.[0])
      .map(line => ({ ...line, uci: line.pv[0], loss: Math.max(0, bestScore - score(line)) }))
      .filter((line, index) => index === 0 || line.loss <= PUZZLE_PLAYABLE_CP_WINDOW);
    return puzzleCandidateMoves;
  } catch (error) {
    console.warn('Branching puzzle analysis unavailable; using repertoire move.', error);
    return [];
  }
}

function puzzleUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

function puzzleBranchLabel(candidate) {
  if (!candidate) return { title:'Playable!', copy:'You found a sound continuation.', points:75, state:'correct' };
  if (candidate.dynamic && candidate.loss <= 15) return { title:'Best-quality path! +100', copy:'That move was not in BOZO’s precomputed shortlist, but fresh analysis confirms it is essentially best.', points:100, state:'correct' };
  if (candidate.dynamic && candidate.loss <= 45) return { title:'Strong alternative! +90', copy:'BOZO did not pre-list this move, but fresh analysis confirms the branch is strong.', points:90, state:'correct' };
  if (candidate.dynamic) return { title:'Playable alternative! +75', copy:'Fresh analysis confirms your idea is sound, so BOZO follows your branch.', points:75, state:'correct' };
  if (candidate.rank === 1 || candidate.loss <= 15) return { title:'Best path! +100', copy:'You chose the strongest continuation.', points:100, state:'correct' };
  if (candidate.loss <= 45) return { title:'Strong path! +90', copy:'Not the top engine choice, but this continuation is fully playable.', points:90, state:'correct' };
  return { title:'Playable path! +75', copy:'This is a sound alternative. BOZO will follow your branch.', points:75, state:'correct' };
}

async function advancePuzzleOpponentMoves() {
  if (!puzzleGame || puzzleGame.game_over()) return;
  // If the user stayed on the authored repertoire line, preserve its reply.
  if (puzzlePly < puzzleMoves.length && !isPuzzleUserTurn()) {
    const authored = puzzleGame.move(puzzleMoves[puzzlePly], { sloppy:true });
    if (authored) {
      puzzlePly++;
      puzzleCandidateFen = ''; puzzleCandidateMoves = [];
      return;
    }
  }
  // A user-selected alternative can leave the authored line. Continue with the
  // strongest reply from the actual resulting position instead of forcing the PGN.
  if (!isPuzzleUserTurn()) {
    try {
      const engine = await getReviewEngine();
      const analysis = await engine.analyze(puzzleGame.fen(), PUZZLE_BRANCH_DEPTH);
      if (analysis?.bestMove) puzzleGame.move({
        from:analysis.bestMove.slice(0,2), to:analysis.bestMove.slice(2,4), promotion:analysis.bestMove[4] || 'q'
      });
    } catch (error) { console.warn('Could not continue puzzle branch.', error); }
  }
  puzzleCandidateFen = ''; puzzleCandidateMoves = [];
}

function paintPuzzleBoard() {
  const boardEl = $('puzzle-board');
  if (!boardEl || !puzzleGame) return;
  const ranks = puzzleUserSide === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = puzzleUserSide === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a'];
  const html=[];
  for (const rank of ranks) for (const file of files) {
    const square=`${file}${rank}`; const piece=puzzleGame.get(square); const symbol=piece?`${piece.color}${piece.type.toUpperCase()}`:'';
    html.push(`<button type="button" data-square="${square}" data-piece-color="${piece?.color==='w'?'white':piece?.color==='b'?'black':''}" class="${puzzleSelectedSquare===square?'selected':''}">${webPiece(symbol)}</button>`);
  }
  boardEl.innerHTML=html.join('');
  syncBoardUserAnnotationPosition('puzzle-board', `${puzzleGame.fen()}|${puzzleUserSide}`);
  boardEl.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>clickPuzzleSquare(button.dataset.square)));
}

function puzzleEngineScore(line) {
  if (!line) return -100000;
  if (line.mate !== null && line.mate !== undefined) return line.mate > 0 ? 100000-Math.abs(line.mate)*100 : -100000+Math.abs(line.mate)*100;
  return Number(line.cp ?? -100000);
}

async function evaluatePlayedPuzzleMove(fenBefore, playedUci, knownCandidates=[]) {
  const known=knownCandidates.find(item=>item.uci===playedUci);
  if (known) return { candidate:known, loss:known.loss, dynamic:false };
  const before=new Chess(fenBefore);
  const move=before.move({from:playedUci.slice(0,2),to:playedUci.slice(2,4),promotion:playedUci[4]||'q'});
  if (!move) return { candidate:null, loss:Infinity, dynamic:true };
  const best=knownCandidates[0];
  let bestScore=best ? puzzleEngineScore(best) : null;
  const engine=await getReviewEngine();
  if (bestScore===null) {
    const roots=await engine.analyzeMultiPv(fenBefore, PUZZLE_BRANCH_DEPTH, 2);
    bestScore=roots.length ? puzzleEngineScore(roots[0]) : 0;
  }
  if (before.game_over()) {
    if (before.in_checkmate?.()) return { candidate:{uci:playedUci,rank:99,loss:0,dynamic:true}, loss:0, dynamic:true };
    return { candidate:{uci:playedUci,rank:99,loss:Math.max(0,bestScore),dynamic:true}, loss:Math.max(0,bestScore), dynamic:true };
  }
  const after=await engine.analyze(before.fen(), PUZZLE_BRANCH_DEPTH);
  // Stockfish reports from the side-to-move perspective. After our move that is the
  // opponent, so negate it to compare against the original player's root score.
  const afterLine={cp:after.cp,mate:after.mate};
  const userScore=-puzzleEngineScore(afterLine);
  const loss=Math.max(0,bestScore-userScore);
  return { candidate:{uci:playedUci,rank:99,loss,dynamic:true,pv:[playedUci,...(after.pv||[])]}, loss, dynamic:true };
}

function resolvePuzzleLegalMove(from, to) {
  if (!puzzleGame) return null;
  const legal = puzzleGame.moves({ verbose:true }).filter(move => move.from === from && move.to === to);
  if (!legal.length) return null;
  // Default to queen promotion when the destination admits several promotion choices.
  return legal.find(move => move.promotion === 'q') || legal[0];
}

async function clickPuzzleSquare(square) {
  if (!puzzleGame || !isPuzzleUserTurn() || puzzleCompleting) return;
  const myColor = puzzleUserSide === 'white' ? 'w' : 'b';
  if (!puzzleSelectedSquare) {
    const piece=puzzleGame.get(square); if (!piece || piece.color!==myColor) return;
    puzzleSelectedSquare=square; paintPuzzleBoard(); return;
  }
  const from=puzzleSelectedSquare; puzzleSelectedSquare=null;
  const legalMove = resolvePuzzleLegalMove(from, square);
  if (!legalMove) {
    setPuzzleFeedback('wrong','That move is not legal here.','BOZO checks legality from the current board before evaluating move quality.');
    paintPuzzleBoard(); updatePuzzleUI(); return;
  }
  const playedUci = puzzleUci(legalMove);
  if (puzzleCurrentReviewItem) { puzzleCurrentReviewItem.attempts.push({uci:playedUci,san:legalMove.san||playedUci}); if (!puzzleCurrentReviewItem.attemptedMove) puzzleCurrentReviewItem.attemptedMove=legalMove.san||playedUci; }
  puzzleAttemptsForPly++;

  setPuzzleFeedback('neutral','Checking your path…','BOZO is analyzing the move you actually chose.');
  const candidates = await loadPuzzleCandidates();
  const expected = expectedPuzzleMove();
  const authoredMatch = expected && puzzleUci(expected) === playedUci;
  let candidate = candidates.find(item => item.uci === playedUci);

  if (!candidate && !authoredMatch) {
    try {
      const judged = await evaluatePlayedPuzzleMove(puzzleGame.fen(), playedUci, candidates);
      candidate = judged.candidate;
    } catch (error) {
      console.warn('Could not dynamically evaluate puzzle move.', error);
    }
  }

  if (!candidate && !authoredMatch || (candidate && candidate.loss > PUZZLE_PLAYABLE_CP_WINDOW && !authoredMatch)) {
    puzzleStats.mistakes++; puzzleStats.streak=0;
    const lossText = candidate && Number.isFinite(candidate.loss) ? ` It gives up about ${(candidate.loss/100).toFixed(1)} pawns of evaluation compared with the best continuation.` : '';
    setPuzzleFeedback('wrong','Legal, but this path gives up too much.', `The move is legal. BOZO evaluated it from the current position rather than checking a preset answer.${lossText}`);
    paintPuzzleBoard(); updatePuzzleUI();
    if (isPuzzleRunMode()) {
      puzzleRunStrikes--; puzzleFailedCurrent=true; puzzleRunOutcomes.push('bad'); updatePuzzleRunHud();
      if (puzzleRunStrikes<=0) return setTimeout(()=>finishPuzzleSession('strikes'),500);
      puzzleCompleting=true; return setTimeout(()=>completeCurrentPuzzle(true,true),450);
    }
    return;
  }

  const move = puzzleGame.move(legalMove.san, { sloppy:true }) || puzzleGame.move({from:legalMove.from,to:legalMove.to,promotion:legalMove.promotion});
  const stayedOnBook = authoredMatch;
  if (stayedOnBook) puzzlePly++;
  else puzzlePly = puzzleMoves.length; // branch has intentionally left the authored PGN

  puzzleStats.userMoves++;
  const cleanFirstTry = puzzleAttemptsForPly===1 && !puzzleHintUsed && !puzzleAnswerUsed;
  const quality = puzzleBranchLabel(candidate);
  if (cleanFirstTry) { puzzleStats.firstTry++; puzzleStats.streak++; puzzleStats.score += quality.points; }
  else if (!puzzleAnswerUsed) { puzzleStats.score += Math.round(quality.points * (puzzleHintUsed ? .6 : .5)); puzzleStats.streak=0; }
  else puzzleStats.streak=0;
  puzzleStats.bestStreak=Math.max(puzzleStats.bestStreak,puzzleStats.streak);
  puzzleSolvedInCurrent++;
  setPuzzleFeedback(quality.state, cleanFirstTry ? quality.title : quality.title.replace(/ \+\d+$/,''), `${move.san}. ${quality.copy}`);
  puzzleAttemptsForPly=0; puzzleHintUsed=false; puzzleAnswerUsed=false;

  // A terminal chess position ends the puzzle immediately. Do not ask the side
  // that has just been checkmated (or stalemated) to make another move simply
  // because this generated puzzle originally targeted multiple continuation moves.
  if (puzzleGame.game_over()) {
    const isMate = Boolean(puzzleGame.in_checkmate?.());
    const isStalemate = Boolean(puzzleGame.in_stalemate?.());
    if (isMate) {
      setPuzzleFeedback('correct', cleanFirstTry ? 'Checkmate! +100' : 'Checkmate!', `${move.san} ends the game. The puzzle is complete.`);
    } else if (isStalemate) {
      setPuzzleFeedback('neutral', 'Stalemate.', `${move.san} ends the game in a draw.`);
    } else {
      setPuzzleFeedback('neutral', 'Game over.', `${move.san} ends the position.`);
    }
    paintPuzzleBoard(); updatePuzzleUI(); puzzleCompleting=true;
    setTimeout(() => completeCurrentPuzzle(false,true), 750);
    return;
  }

  if (puzzleSolvedInCurrent >= puzzleTargetUserMoves) {
    paintPuzzleBoard(); updatePuzzleUI(); puzzleCompleting=true;
    setTimeout(() => completeCurrentPuzzle(false,true), 650); return;
  }
  await advancePuzzleOpponentMoves();
  paintPuzzleBoard(); updatePuzzleUI();
  if (puzzleGame && isPuzzleUserTurn()) {
    await loadPuzzleCandidates();
    const recent=puzzleResolutionEvals.slice(-3);
    const stable=recent.length===3 && Math.max(...recent.map(Math.abs))-Math.min(...recent.map(Math.abs))<70 && Math.min(...recent.map(x=>Math.abs(x)))>=250;
    if (puzzleGeneralMode && puzzleSolvedInCurrent>=2 && stable) {
      setPuzzleFeedback('correct','Tactic resolved.', 'The evaluation has flattened out after the combination, so BOZO ends the puzzle here instead of forcing routine conversion moves.');
      puzzleCompleting=true; return setTimeout(()=>completeCurrentPuzzle(false,true),550);
    }
  }
}

function expectedPuzzleMove() {
  if (!puzzleGame || !isPuzzleUserTurn()) return null;
  if (puzzlePly < puzzleMoves.length) {
    const clone=new Chess(puzzleGame.fen());
    const move=clone.move(puzzleMoves[puzzlePly],{sloppy:true});
    if (move) return move;
  }
  const best = puzzleCandidateMoves[0]?.uci;
  if (!best) return null;
  const clone=new Chess(puzzleGame.fen());
  return clone.move({from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||'q'});
}

async function showPuzzleHint() {
  if (isPuzzleRunMode() && puzzleRunHints<=0) { setPuzzleFeedback('hint','No hints left.','You have used all three hints for this run.'); return; }
  puzzleHintUsed=true; puzzleStats.streak=0;
  if (puzzleCurrentReviewItem) puzzleCurrentReviewItem.hintUsed=true;
  const candidates=await loadPuzzleCandidates();
  const move=expectedPuzzleMove(); if (!move) return;
  if (isPuzzleRunMode()) { puzzleRunHints--; puzzleRunHintsUsed++; }
  const piece=puzzleGame.get(move.from); const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
  let clue='Look for a forcing idea.';
  if (/[+#]/.test(move.san)) clue='Look for a check or a forcing king move.';
  else if (move.captured) clue='A capture changes the tactical balance here.';
  else if (/fork/i.test(puzzleGeneralMotif)) clue='Look for a double attack.';
  else if (/exchange sacrifice/i.test(puzzleGeneralMotif)) clue='Consider whether giving up a rook can buy a stronger tactical payoff.';
  else if (/sacrifice for mate/i.test(puzzleGeneralMotif)) clue='A forcing attack may be worth more than material.';
  else if (/sacrifice/i.test(puzzleGeneralMotif)) clue='A temporary material investment may unlock the tactic.';
  else if (/forcing/i.test(puzzleGeneralMotif)) clue='Checks, captures, and direct threats deserve priority.';
  else if (puzzleRunHintsUsed % 2) clue=`Focus on your ${names[piece?.type]||'piece'}.`;
  else clue=`The ${move.from[0]}-file matters in this position.`;
  const extra=candidates.length>1 ? ' More than one playable path may exist, but BOZO is hinting at the strongest idea.' : '';
  setPuzzleFeedback('hint','Contextual hint',`${clue}${extra}`); updatePuzzleRunHud(); updatePuzzleUI();
}

async function showPuzzleAnswer() {
  puzzleAnswerUsed=true; puzzleStats.streak=0;
  const candidates=await loadPuzzleCandidates();
  if (!candidates.length) {
    const move=expectedPuzzleMove(); if (!move) return;
    setPuzzleFeedback('answer','Best path',`${move.san} · ${move.from} → ${move.to}`); updatePuzzleUI(); return;
  }
  const readable=candidates.slice(0,3).map((item,index)=>{
    const clone=new Chess(puzzleGame.fen());
    const m=clone.move({from:item.uci.slice(0,2),to:item.uci.slice(2,4),promotion:item.uci[4]||'q'});
    return `${index===0?'Best':'Playable'}: ${m?.san || item.uci}`;
  });
  setPuzzleFeedback('answer','Choose your path',readable.join(' · ')); updatePuzzleUI();
}
function skipPuzzle() {
  if (!puzzleGame || puzzleCompleting) return;
  puzzleStats.skipped++; puzzleStats.streak=0;
  if (isPuzzleRunMode()) { puzzleRunStrikes--; puzzleFailedCurrent=true; puzzleRunOutcomes.push('bad'); updatePuzzleRunHud(); if (puzzleRunStrikes<=0) return finishPuzzleSession('strikes'); }
  completeCurrentPuzzle(true);
}
function setPuzzleFeedback(stateName,title,copy) {
  const el=$('puzzle-feedback'); if (!el) return;
  el.dataset.state=stateName; el.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span>`;
  el.classList.remove('puzzle-pop'); void el.offsetWidth; el.classList.add('puzzle-pop');
}
function updatePuzzleUI() {
  const accuracy=puzzleStats.userMoves ? Math.round(puzzleStats.firstTry/puzzleStats.userMoves*100) : 0;
  $('puzzle-score').textContent=isPuzzleRunMode()?puzzleRunSolved:puzzleStats.score;
  $('puzzle-streak').textContent=puzzleStats.streak;
  $('puzzle-accuracy').textContent=`${accuracy}%`;
  const accuracyCard=$('puzzle-accuracy')?.closest('article'); if(accuracyCard) accuracyCard.hidden=isPuzzleRunMode();
  if (!puzzleGame) {
    $('puzzle-turn-label').textContent='Find the move';
  } else if (puzzleGame.game_over()) {
    $('puzzle-turn-label').textContent = puzzleGame.in_checkmate?.() ? 'Checkmate' : puzzleGame.in_stalemate?.() ? 'Stalemate' : 'Game over';
  } else {
    $('puzzle-turn-label').textContent=`${puzzleSideToMove()[0].toUpperCase()+puzzleSideToMove().slice(1)} to move`;
  }
  $('puzzle-instruction').textContent = puzzleGame?.game_over()
    ? `${puzzleSolvedInCurrent} continuation move${puzzleSolvedInCurrent===1?'':'s'} solved · position complete`
    : `${puzzleSolvedInCurrent}/${puzzleTargetUserMoves} continuation moves solved`;
  $('puzzle-track-fill').style.width=`${puzzleTargetUserMoves ? Math.min(100,puzzleSolvedInCurrent/puzzleTargetUserMoves*100) : 0}%`;
  const history=puzzleGame?.history().slice(puzzleStartPly) || [];
  $('puzzle-move-history').innerHTML=history.length ? history.map((m,i)=>`<span>${escapeHtml(m)}</span>`).join('') : '<small>No continuation moves revealed yet.</small>';
}
function completeCurrentPuzzle(skipped=false, forced=false) {
  if (!puzzleGame || (puzzleCompleting && !forced)) return;
  puzzleCompleting=true;
  if (isPuzzleRunMode() && !skipped && !puzzleFailedCurrent) {
    puzzleRunSolved++; puzzleRunOutcomes.push('ok');
    if (puzzleCurrentStartedAt) puzzleSolveTimes.push((Date.now()-puzzleCurrentStartedAt)/1000);
  }
  if (puzzleCurrentReviewItem) {
    puzzleCurrentReviewItem.result = skipped || puzzleFailedCurrent ? 'failed' : 'solved';
    puzzleCurrentReviewItem.playedLine = puzzleGame?.history().slice(puzzleStartPly) || [];
    puzzleRunReviewItems.push({...puzzleCurrentReviewItem});
    puzzleCurrentReviewItem=null;
  }
  puzzleGame=null; puzzleStats.index++;
  updatePuzzleRunHud();
  if (!isPuzzleRunMode() && puzzleStats.index >= puzzleStats.total) return finishPuzzleSession();
  if (isTimedPuzzleRun() && puzzleRunDeadline && Date.now()>=puzzleRunDeadline) return finishPuzzleSession('time');
  setTimeout(startNextPuzzle, skipped ? 80 : 180);
}
function finishPuzzleSession(reason='complete') {
  clearInterval(puzzleRunTimer); puzzleRunTimer=null; puzzleRunDeadline=0;
  if (puzzleCurrentReviewItem) {
    puzzleCurrentReviewItem.result='unfinished';
    puzzleCurrentReviewItem.playedLine=puzzleGame?.history().slice(puzzleStartPly)||[];
    puzzleRunReviewItems.push({...puzzleCurrentReviewItem});
    puzzleCurrentReviewItem=null;
  }
  $('puzzle-session').hidden=true; $('puzzle-results').hidden=false;
  const accuracy=puzzleStats.userMoves ? Math.round(puzzleStats.firstTry/puzzleStats.userMoves*100) : 0;
  const score=isPuzzleRunMode()?puzzleRunSolved:puzzleStats.score;
  const avg=puzzleSolveTimes.length ? puzzleSolveTimes.reduce((a,b)=>a+b,0)/puzzleSolveTimes.length : 0;
  $('puzzle-result-score').textContent=score;
  $('puzzle-result-score-label').textContent=isPuzzleRunMode()?'Puzzles solved':'Points earned';
  const accCard=$('puzzle-result-accuracy')?.closest('article');
  if(accCard) accCard.hidden=isPuzzleRunMode();
  $('puzzle-result-accuracy').textContent=`${accuracy}%`;
  $('puzzle-result-streak').textContent=puzzleStats.bestStreak;
  if ($('puzzle-result-hints')) $('puzzle-result-hints').textContent=isPuzzleRunMode()?`${puzzleRunHintsUsed}/3`:' - ';
  if ($('puzzle-result-time')) $('puzzle-result-time').textContent=avg?`${avg.toFixed(1)}s`:' - ';
  if ($('puzzle-result-difficulty')) $('puzzle-result-difficulty').textContent=' - ';
  const cfg=puzzleRunConfig();
  $('puzzle-results-title').textContent=isPuzzleRunMode()
    ? reason==='time'?`${cfg.label}: time!`:reason==='strikes'?`${cfg.label}: three strikes.`:`${cfg.label} complete.`
    : accuracy===100?'Perfect puzzle run.':accuracy>=85?'Opening instincts are sharp.':accuracy>=65?'Strong run. Keep building.':'BOZO found some weak spots.';
  try {
    const key=isPuzzleRunMode()?`bozo_puzzle_${puzzleRunMode}_v1`:puzzleStorageKey();
    const previous=JSON.parse(localStorage.getItem(key)||'{}');
    localStorage.setItem(key,JSON.stringify(isPuzzleRunMode()?{sessions:(previous.sessions||0)+1,bestScore:Math.max(previous.bestScore||0,score),lastScore:score,bestDifficulty:0,playedAt:new Date().toISOString()}:{sessions:(previous.sessions||0)+1,bestScore:Math.max(previous.bestScore||0,score),bestStreak:Math.max(previous.bestStreak||0,puzzleStats.bestStreak),lastAccuracy:accuracy,lastScore:score,bestDifficulty:0,playedAt:new Date().toISOString()}));
  } catch {}
  if (isPuzzleRunMode()) {
    const durationSeconds=puzzleRunStartedAt?Math.max(0,Math.round((Date.now()-puzzleRunStartedAt)/1000)):0;
    savePuzzleRunCloud({score,hintsUsed:puzzleRunHintsUsed,avgSolve:avg,peakDifficulty:0,reason,durationSeconds,items:puzzleRunReviewItems}).catch(()=>{});
  } else puzzleCloudSetStatus();
  if ($('puzzle-review-run')) $('puzzle-review-run').hidden=!puzzleRunReviewItems.length;
  if ($('puzzle-run-review')) $('puzzle-run-review').hidden=true;
  logActivity?.('bozo_puzzles_completed',{ mode:puzzleRunMode, score, hints_used:puzzleRunHintsUsed }).catch?.(()=>{});
}


function paintPuzzleReviewBoard(item){
  const target=$('puzzle-run-review-board'); if(!target || !item?.fen) return;
  const board=fenBoard(item.fen);
  const orientation=item.side==='black'?'black':'white';
  const ranks=orientation==='white'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const files=orientation==='white'?[...'abcdefgh']:[...'hgfedcba'];
  target.innerHTML=ranks.flatMap(rank=>files.map(file=>{
    const row=8-rank,col=file.charCodeAt(0)-97;
    return `<div data-square="${file}${rank}">${webPiece(board[row][col])}</div>`;
  })).join('');
}
function renderPuzzleRunReview(index=0,items=puzzleRunReviewItems){
  if(!items?.length) return;
  puzzleRunReviewItems=items;
  puzzleReviewIndex=Math.max(0,Math.min(index,items.length-1));
  const item=items[puzzleReviewIndex];
  const root=$('puzzle-run-review'); if(root) root.hidden=false;
  if($('puzzle-run-review-title')) $('puzzle-run-review-title').textContent=`${puzzleModeLabel(puzzleRunMode)} · ${items.length} puzzle${items.length===1?'':'s'}`;
  const strip=$('puzzle-run-review-strip');
  if(strip){
    strip.innerHTML=items.map((x,i)=>`<button type="button" class="${i===puzzleReviewIndex?'active':''} ${x.result==='solved'?'ok':x.result==='unfinished'?'pending':'bad'}" data-run-review-index="${i}">${i+1}${x.result==='solved'?'✓':x.result==='unfinished'?'…':'×'}</button>`).join('');
    strip.querySelectorAll('[data-run-review-index]').forEach(b=>b.addEventListener('click',()=>renderPuzzleRunReview(Number(b.dataset.runReviewIndex),items)));
  }
  paintPuzzleReviewBoard(item);
  const status=item.result==='solved'?'SOLVED':item.result==='unfinished'?'UNFINISHED':'MISSED';
  if($('puzzle-run-review-status')) $('puzzle-run-review-status').textContent=status;
  if($('puzzle-run-review-heading')) $('puzzle-run-review-heading').textContent=`Puzzle ${puzzleReviewIndex+1} · ${item.side==='black'?'Black':'White'} to move`;
  const motif=item.motif && item.motif!=='Tactical decision'?` · ${item.motif}`:'';
  if($('puzzle-run-review-meta')) $('puzzle-run-review-meta').textContent=`${status[0]+status.slice(1).toLowerCase()}${item.hintUsed?' · hint used':''}${motif}`;
  const line=$('puzzle-run-review-line');
  if(line){
    const played=(item.playedLine||[]).join(' ');
    const attempt=item.attemptedMove||'';
    let solution='';
    try { const g=new Chess(item.fen); solution=(item.solutionPv||[]).map(uci=>{const m=g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});return m?.san||uci;}).join(' '); } catch { solution=(item.solutionPv||[]).join(' '); }
    line.innerHTML=`${attempt?`<p><b>First try:</b> ${escapeHtml(attempt)}</p>`:''}${played?`<p><b>Played:</b> ${escapeHtml(played)}</p>`:''}${solution?`<p><b>Engine line:</b> ${escapeHtml(solution)}</p>`:'<p>Use Analyze position to calculate the position again with Stockfish.</p>'}`;
  }
  if($('puzzle-run-review-prev')) $('puzzle-run-review-prev').disabled=puzzleReviewIndex<=0;
  if($('puzzle-run-review-next')) $('puzzle-run-review-next').disabled=puzzleReviewIndex>=items.length-1;
}
async function loadCloudPuzzleRunReview(runId){
  if(!runId || !puzzleCloudSignedIn()) return;
  const note=$('puzzle-cloud-review-note'); if(note){note.hidden=false;note.textContent='Loading saved run review…';}
  const {data,error}=await sb.from('puzzle_run_items').select('item_index,fen,result,attempted_move,played_line,solution_pv,motif,hint_used').eq('run_id',runId).order('item_index',{ascending:true});
  if(error){ if(note) note.textContent='This run has only a summary. Apply BOZO_V4118_PUZZLE_RUN_REVIEW.sql to save puzzle-by-puzzle history.'; return; }
  const items=(data||[]).map(row=>({fen:row.fen,result:row.result,attemptedMove:row.attempted_move,playedLine:row.played_line||[],solutionPv:row.solution_pv||[],motif:row.motif||'',hintUsed:Boolean(row.hint_used),side:(row.fen||'').split(' ')[1]==='b'?'black':'white'}));
  if(!items.length){ if(note) note.textContent='No detailed puzzles were saved for this older run.'; return; }
  if(note) note.hidden=true;
  $('puzzle-results').hidden=false;
  renderPuzzleRunReview(0,items);
  $('puzzle-run-review')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function analyzeReviewedPuzzle(){
  const item=puzzleRunReviewItems[puzzleReviewIndex]; if(!item?.fen) return;
  route('review');
  setTimeout(()=>{
    document.querySelector('[data-review-mode="position"]')?.click();
    positionLoadFen(item.fen,true); positionSyncFen();
    if($('position-fen')) $('position-fen').value=item.fen;
    $('review-position-mode')?.scrollIntoView({behavior:'smooth',block:'start'});
  },80);
}
$('puzzle-review-run')?.addEventListener('click',()=>renderPuzzleRunReview(0,puzzleRunReviewItems));
$('puzzle-run-review-close')?.addEventListener('click',()=>{if($('puzzle-run-review')) $('puzzle-run-review').hidden=true;});
$('puzzle-run-review-prev')?.addEventListener('click',()=>renderPuzzleRunReview(puzzleReviewIndex-1,puzzleRunReviewItems));
$('puzzle-run-review-next')?.addEventListener('click',()=>renderPuzzleRunReview(puzzleReviewIndex+1,puzzleRunReviewItems));
$('puzzle-run-review-analyze')?.addEventListener('click',analyzeReviewedPuzzle);
$('puzzle-run-history')?.addEventListener('click',()=>{ const mode=puzzleRunMode; showBozoPuzzlePicker(); loadPuzzleCloudData(mode).catch(()=>{}); setTimeout(()=>document.querySelector('.puzzle-cloud-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),80); });


// BOZO board coordinates: chess.com-style edge labels on every 8x8 board.
function bozoSquareFromCell(cell){
  if(!cell) return '';
  const direct=cell.getAttribute?.('aria-label');
  if(/^[a-h][1-8]$/.test(direct||'')) return direct;
  for(const value of Object.values(cell.dataset||{})) if(/^[a-h][1-8]$/.test(String(value))) return String(value);
  return '';
}
function decorateBozoBoardCoordinates(board){
  if(!board) return;
  const cells=[...board.children].filter(el=>/^[a-h][1-8]$/.test(bozoSquareFromCell(el)));
  if(cells.length!==64) return;
  cells.forEach((cell,index)=>{
    delete cell.dataset.coordFile; delete cell.dataset.coordRank;
    const sq=bozoSquareFromCell(cell), row=Math.floor(index/8), col=index%8;
    if(col===0) cell.dataset.coordRank=sq[1];
    if(row===7) cell.dataset.coordFile=sq[0];
  });
  board.classList.add('bozo-coordinate-board');
}
function initializeBozoBoardCoordinates(){
  const scan=root=>{
    if(root?.nodeType!==1) return;
    decorateBozoBoardCoordinates(root);
    root.querySelectorAll?.('[id$="-board"], .web-duel-board, .opening-study-board, .study-board').forEach(decorateBozoBoardCoordinates);
  };
  scan(document.body);
  const observer=new MutationObserver(records=>records.forEach(record=>{decorateBozoBoardCoordinates(record.target);record.addedNodes.forEach(scan);}));
  observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initializeBozoBoardCoordinates,{once:true}); else initializeBozoBoardCoordinates();

// BOZO universal board annotations
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeUniversalBoardAnnotations);
else initializeUniversalBoardAnnotations();

// ---- Position Analysis (Review tab) ----
let positionEditor = {};
let positionOrientation = 'white';
let positionAnalysis = null;
let positionSelectedPiece = 'K';
let positionVariationIndex = 0;
let positionVariationTimer = null;

function positionFenPlacement(board) {
  const ranks = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '', empty = 0;
    for (const file of 'abcdefgh') {
      const piece = board[`${file}${rank}`];
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece;
    }
    if (empty) row += empty;
    ranks.push(row);
  }
  return ranks.join('/');
}

function positionEditorFen() {
  const side = $('position-side-to-move')?.value || 'w';
  return `${positionFenPlacement(positionEditor)} ${side} - - 0 1`;
}

function positionLoadFen(fen, quiet = false) {
  try {
    const game = new Chess(fen.trim());
    const placement = game.fen().split(' ')[0];
    positionEditor = {};
    placement.split('/').forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) fi += Number(ch);
        else { positionEditor[`${'abcdefgh'[fi]}${8-ri}`] = ch; fi++; }
      }
    });
    const parts = game.fen().split(' ');
    if ($('position-side-to-move')) $('position-side-to-move').value = parts[1] || 'w';
    renderPositionEditor();
    if (!quiet) $('position-message').textContent = '';
    return true;
  } catch (error) {
    if (!quiet) $('position-message').textContent = 'That FEN is not a legal chess position.';
    return false;
  }
}

function positionSyncFen() {
  if ($('position-fen')) $('position-fen').value = positionEditorFen();
}

function renderPositionPalette() {
  const palette = $('position-piece-palette');
  if (!palette) return;
  const pieces = ['K','Q','R','B','N','P','k','q','r','b','n','p'];
  palette.innerHTML = pieces.map(piece => `<button type="button" data-position-piece="${piece}" class="${positionSelectedPiece===piece?'active':''}" title="Place ${piece === piece.toUpperCase() ? 'White' : 'Black'} piece">${webPiece(piece)}</button>`).join('') + `<button type="button" data-position-piece="erase" class="${positionSelectedPiece==='erase'?'active':''}" title="Erase">⌫</button>`;
  $$('[data-position-piece]').forEach(button => button.addEventListener('click', () => {
    positionSelectedPiece = button.dataset.positionPiece;
    renderPositionPalette();
  }));
}

function renderPositionEditor() {
  const board = $('position-editor-board');
  if (!board) return;
  const ranks = positionOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = positionOrientation === 'white' ? [...'abcdefgh'] : [...'hgfedcba'];
  board.innerHTML = ranks.flatMap(rank => files.map(file => {
    const sq = `${file}${rank}`;
    return `<button type="button" class="position-editor-square" data-position-square="${sq}" aria-label="${sq}">${webPiece(positionEditor[sq] || '')}</button>`;
  })).join('');
  $$('[data-position-square]').forEach(square => square.addEventListener('click', () => {
    const sq = square.dataset.positionSquare;
    if (positionSelectedPiece === 'erase') delete positionEditor[sq];
    else positionEditor[sq] = positionSelectedPiece;
    positionSyncFen();
    renderPositionEditor();
  }));
  renderPositionPalette();
}

function paintPositionBoard(fen) {
  const target = $('position-analysis-board');
  if (!target) return;
  const board = fenBoard(fen);
  const ranks = positionOrientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = positionOrientation === 'white' ? [...'abcdefgh'] : [...'hgfedcba'];
  target.innerHTML = ranks.flatMap(rank => files.map(file => {
    const row = 8-rank, col = file.charCodeAt(0)-97;
    return `<div data-square="${file}${rank}">${webPiece(board[row][col])}</div>`;
  })).join('');
  syncBoardUserAnnotationPosition('position-analysis-board', `${fen}|${positionOrientation}`);
}

function paintPositionEval(cp = 0, mate = null) {
  let whitePct = mate != null ? (mate > 0 ? 97 : 3) : 50 + 47 * Math.tanh(cp / 500);
  whitePct = Math.max(3, Math.min(97, whitePct));
  if ($('position-eval-white-zone')) $('position-eval-white-zone').style.height = `${whitePct}%`;
  if ($('position-eval-black-zone')) $('position-eval-black-zone').style.height = `${100-whitePct}%`;

  // Position Analysis owns a separate vertical bar from Game Review, so it needs
  // its own visible evaluation readout rather than relying on the result card.
  const topLabel = $('position-eval-top-label');
  const bottomLabel = $('position-eval-bottom-label');
  if (topLabel) topLabel.textContent = positionOrientation === 'white' ? 'Black' : 'White';
  if (bottomLabel) bottomLabel.textContent = positionOrientation === 'white' ? 'White' : 'Black';

  const value = $('position-eval-value-label');
  if (value) {
    const display = mate != null
      ? `M${Math.abs(mate)}`
      : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`;
    value.textContent = display;

    const whiteFavored = mate != null ? mate > 0 : cp >= 0;
    const favoredAtBottom = positionOrientation === 'white' ? whiteFavored : !whiteFavored;
    value.classList.toggle('at-bottom', favoredAtBottom);
    value.classList.toggle('at-top', !favoredAtBottom);
    value.classList.toggle('on-white', favoredAtBottom);
    value.classList.toggle('on-black', !favoredAtBottom);
  }

  const description = reviewPositionDescription(cp, mate);
  const bar = $('position-vertical-eval');
  if (bar) {
    bar.setAttribute('aria-label', `${description}. Evaluation ${mate != null ? `mate in ${Math.abs(mate)}` : formatReviewEval(cp, null)}`);
    bar.title = description;
  }
}

async function analyzePosition() {
  const message = $('position-message');
  const button = $('analyze-position');
  message.textContent = '';
  const rawFen = $('position-fen').value.trim();
  if (!positionLoadFen(rawFen)) return;
  const fen = positionEditorFen();
  let game;
  try { game = new Chess(fen); } catch (_) { message.textContent = 'That position cannot be analyzed. Check both kings and the side to move.'; return; }
  button.disabled = true; button.textContent = 'Analyzing…';
  try {
    const engine = await getReviewEngine();
    await engine.newGame();
    const depth = Number($('position-depth').value || 14);
    const result = await engine.analyze(fen, depth);
    const cp = whiteReviewEval(result, game.turn());
    const bestSan = reviewUciToSan(fen, result.bestMove) || result.bestMove || ' - ';
    const pvSan = reviewPvToSan(fen, result.pv || [], 8);
    const mate = whiteReviewMate(result, game.turn());
    positionAnalysis = { fen, cp, mate, bestMove: bestSan, bestMoveUci: result.bestMove, pv: result.pv || [], pvSan };
    positionVariationIndex=0; clearInterval(positionVariationTimer); positionVariationTimer=null;
    $('position-results').hidden = false;
    paintPositionBoard(fen); paintPositionEval(cp, mate);
    $('position-description').textContent = reviewPositionDescription(cp, mate);
    $('position-evaluation').textContent = formatReviewEval(cp, mate);
    $('position-best-move').textContent = bestSan;
    $('position-turn-label').textContent = game.turn() === 'w' ? 'White' : 'Black';
    $('position-eval-summary').textContent = `${reviewPositionDescription(cp, mate)}. ${game.turn()==='w'?'White':'Black'} to move${bestSan !== ' - ' ? `, with ${bestSan} as the strongest continuation.` : '.'}`;
    renderPositionVariationLine();
    if ($('position-line-controls')) $('position-line-controls').hidden = !pvSan.length;
    $('position-coach-answer').textContent = 'Position analyzed. Choose a question below or ask your own.';
    $('position-results').scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) {
    console.error(error); message.textContent = error?.message || 'Position analysis failed.';
  } finally { button.disabled = false; button.textContent = 'Analyze position'; }
}

function positionVariationFen(index=0){
  if (!positionAnalysis) return null;
  const game=new Chess(positionAnalysis.fen);
  const pv=positionAnalysis.pv||[];
  for(let i=0;i<Math.min(index,pv.length);i++){
    const uci=pv[i];
    const move=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
    if (!move) break;
  }
  return game.fen();
}
function renderPositionVariationLine(){
  const root=$('position-best-line'); if (!root) return;
  const san=positionAnalysis?.pvSan||[];
  if (!san.length){ root.textContent='No principal variation available.'; return; }
  root.innerHTML=`<span>Recommended line:</span> ${san.map((move,i)=>`<button type="button" class="position-pv-move ${i<positionVariationIndex?'played':''} ${i===positionVariationIndex-1?'current':''}" data-position-pv="${i+1}">${escapeHtml(move)}</button>`).join(' ')}`;
  root.querySelectorAll('[data-position-pv]').forEach(btn=>btn.addEventListener('click',()=>jumpPositionVariation(Number(btn.dataset.positionPv))));
}
function jumpPositionVariation(index){
  if (!positionAnalysis) return;
  clearInterval(positionVariationTimer); positionVariationTimer=null;
  positionVariationIndex=Math.max(0,Math.min(index,(positionAnalysis.pv||[]).length));
  const fen=positionVariationFen(positionVariationIndex); if (fen) paintPositionBoard(fen);
  renderPositionVariationLine();
  if ($('position-line-play')) $('position-line-play').textContent='▶ Play line';
}
function playPositionVariation(){
  if (!positionAnalysis?.pv?.length) return;
  if (positionVariationTimer){ clearInterval(positionVariationTimer); positionVariationTimer=null; $('position-line-play').textContent='▶ Play line'; return; }
  if (positionVariationIndex >= positionAnalysis.pv.length) positionVariationIndex=0;
  $('position-line-play').textContent='⏸ Pause';
  positionVariationTimer=setInterval(()=>{
    if (positionVariationIndex>=positionAnalysis.pv.length){ clearInterval(positionVariationTimer); positionVariationTimer=null; $('position-line-play').textContent='▶ Replay line'; return; }
    jumpPositionVariation(positionVariationIndex+1);
    if (positionVariationIndex<positionAnalysis.pv.length && $('position-line-play')) $('position-line-play').textContent='⏸ Pause';
  },700);
}
function initPositionVariationControls(){
  $('position-line-start')?.addEventListener('click',()=>jumpPositionVariation(0));
  $('position-line-back')?.addEventListener('click',()=>jumpPositionVariation(positionVariationIndex-1));
  $('position-line-next')?.addEventListener('click',()=>jumpPositionVariation(positionVariationIndex+1));
  $('position-line-end')?.addEventListener('click',()=>jumpPositionVariation(positionAnalysis?.pv?.length||0));
  $('position-line-reset')?.addEventListener('click',()=>jumpPositionVariation(0));
  $('position-line-play')?.addEventListener('click',playPositionVariation);
}

async function askPositionCoach() {
  const answer = $('position-coach-answer'), button = $('ask-position-coach');
  if (!state.session?.user) { answer.textContent = 'Sign in before using BOZO Coach.'; return; }
  if (!positionAnalysis) { answer.textContent = 'Analyze the position first.'; return; }
  const perspective = $('position-perspective').value;
  const question = $('position-coach-question').value.trim() || 'What is the main plan in this position, why is the best move strong, and what should I watch for?';
  button.disabled = true; button.textContent = 'BOZO Coach is thinking…';
  answer.innerHTML = '<div class="coach-thinking">Turning the position into a practical explanation…</div>';
  try {
    const { data, error } = await sb.functions.invoke('explain-move', { body: {
      mode: 'position_analysis', fen: positionAnalysis.fen, playedMove: '',
      selectedSide: perspective === 'neutral' ? '' : perspective,
      bestMove: positionAnalysis.bestMove,
      principalVariation: positionAnalysis.pv,
      principalVariationSan: positionAnalysis.pvSan,
      evaluationAfter: positionAnalysis.cp,
      evaluationUnit: 'centipawns from White perspective', question
    }});
    if (error) throw error;
    const ex = data?.explanation;
    if (!ex) throw new Error(data?.error || 'BOZO Coach returned no explanation.');
    const parts = [ex.summary, ex.playedMoveIdea, ex.practicalPlan?.length ? `<b>Plan:</b><ul>${ex.practicalPlan.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '', ex.watchFor ? `<b>Watch for:</b> ${escapeHtml(ex.watchFor)}` : ''].filter(Boolean);
    answer.innerHTML = parts.map((x,i) => i < 2 && typeof x === 'string' && !x.startsWith('<') ? `<p>${escapeHtml(x)}</p>` : x).join('');
  } catch (error) { console.error(error); answer.textContent = error?.message || 'BOZO Coach could not explain this position.'; }
  finally { button.disabled = false; button.textContent = 'Ask BOZO'; }
}

function initPositionAnalysis() {
  if (!$('review-position-mode')) return;
  initPositionVariationControls();
  const startFen = new Chess().fen();
  positionLoadFen(startFen, true); positionSyncFen();
  $$('[data-review-mode]').forEach(button => button.addEventListener('click', () => {
    const mode=button.dataset.reviewMode||'game', position=mode==='position', master=mode==='master';
    $$('[data-review-mode]').forEach(b => b.classList.toggle('active', b === button));
    $('review-game-mode').hidden = position || master;
    $('review-position-mode').hidden = !position;
    if ($('review-master-mode')) $('review-master-mode').hidden=!master;
    $('review-results').hidden = position || master ? true : !reviewData;
    const heading = document.querySelector('#view-review .review-heading h1');
    const copy = document.querySelector('#view-review .review-heading p');
    if (heading) heading.textContent = master ? 'Review a master game.' : position ? 'Analyze a position.' : 'Review your game.';
    if (copy) copy.textContent = master ? 'Search the Master Database, choose a recorded game, then send it directly into Stockfish + BOZO Coach.' : position ? 'Set up any legal position, evaluate it, then ask BOZO Coach what matters.' : 'Import a PGN, compare each phase, then ask BOZO Coach about any move.';
    if(master) loadReviewMasterGames();
  }));
  $('position-starting').addEventListener('click', () => { positionLoadFen(new Chess().fen(), true); positionSyncFen(); });
  $('position-clear').addEventListener('click', () => { positionEditor = {}; positionSyncFen(); renderPositionEditor(); });
  $('position-flip').addEventListener('click', () => { positionOrientation = positionOrientation === 'white' ? 'black' : 'white'; renderPositionEditor(); });
  $('position-result-flip').addEventListener('click', () => { positionOrientation = positionOrientation === 'white' ? 'black' : 'white'; renderPositionEditor(); if (positionAnalysis) { paintPositionBoard(positionAnalysis.fen); paintPositionEval(positionAnalysis.cp, positionAnalysis.mate); } });
  $('position-side-to-move').addEventListener('change', positionSyncFen);
  $('position-fen').addEventListener('change', () => positionLoadFen($('position-fen').value));
  $('analyze-position').addEventListener('click', analyzePosition);
  $('ask-position-coach').addEventListener('click', askPositionCoach);
  $('clear-position-coach').addEventListener('click', () => { $('position-coach-question').value=''; $('position-coach-answer').textContent='Position analyzed. Choose a question below or ask your own.'; });
  $$('[data-position-question]').forEach(b => b.addEventListener('click', () => { $('position-coach-question').value=b.dataset.positionQuestion; askPositionCoach(); }));
  $('position-coach-question').addEventListener('keydown', e => { if (e.key === 'Enter') askPositionCoach(); });
}

initPositionAnalysis();


/* BOZO v4.5.2 navbar consolidation */

function closeNavMenus(except=null) {
  document.querySelectorAll('.nav-menu').forEach(menu => {
    if (menu === except) return;
    const trigger = menu.querySelector('.nav-menu-trigger');
    const popover = menu.querySelector('.nav-menu-popover');
    if (popover) popover.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded','false');
  });
}

document.querySelectorAll('.nav-menu-trigger').forEach(trigger => {
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const menu = trigger.closest('.nav-menu');
    const popover = menu?.querySelector('.nav-menu-popover');
    if (!popover) return;
    const opening = popover.hidden;
    closeNavMenus(opening ? menu : null);
    popover.hidden = !opening;
    trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });
});

document.querySelectorAll('.nav-menu-popover [data-route]').forEach(item => {
  item.addEventListener('click', () => closeNavMenus());
});

document.addEventListener('click', event => {
  if (!event.target.closest('.nav-menu')) closeNavMenus();
});

/* BOZO v4.6.0 PayPal Sandbox setup */
async function initializeBozoPayPalSandbox() {
  const button=$('bozo-paypal-initialize'), output=$('bozo-paypal-setup-result');
  if(!button||!output)return;
  if(state.role!=='owner'){output.textContent='Owner access required.';return;}
  button.disabled=true; button.textContent='Initializing…'; output.textContent='Contacting PayPal Sandbox…';
  try{
    const {data,error}=await sb.functions.invoke('paypal-bozo-setup',{body:{action:'ensure_plans'}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'PayPal setup failed.');
    output.textContent=`Product: ${data.product_id}\nMonthly: ${data.monthly_plan_id}\nAnnual: ${data.annual_plan_id}\nEnvironment: ${data.environment}`;
    toast('PayPal Sandbox plans are ready');
  }catch(error){output.textContent=readableError(error);}
  finally{button.disabled=false;button.textContent='Initialize PayPal Sandbox';}
}
$('bozo-paypal-initialize')?.addEventListener('click',initializeBozoPayPalSandbox);



/* ============================================================
   BOZO v4.6.1: PayPal Sandbox checkout + verified activation
   ============================================================ */
let bozoPayPalConfig = null;
let bozoPayPalSdkPromise = null;
let bozoPayPalRenderedKey = '';

function resetBozoPayPalCheckout(message='Loading PayPal Sandbox…') {
  bozoPayPalConfig = null;
  bozoPayPalRenderedKey = '';
  ['paypal-monthly-button','paypal-annual-button'].forEach(id => {
    const el=$(id); if(el) el.innerHTML='';
  });
  if($('bozo-paypal-checkout-message')) $('bozo-paypal-checkout-message').textContent=message;
  if($('bozo-paypal-current-subscription')) {
    $('bozo-paypal-current-subscription').hidden=true;
    $('bozo-paypal-current-subscription').innerHTML='';
  }
}

function bozoPlanLabel(planKey) {
  return planKey === 'annual' ? '$59.99/year' : '$5.99/month';
}

function loadPayPalSubscriptionSdk(clientId) {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (bozoPayPalSdkPromise) return bozoPayPalSdkPromise;

  bozoPayPalSdkPromise = new Promise((resolve,reject) => {
    const script=document.createElement('script');
    script.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&vault=true&intent=subscription&currency=USD`;
    script.async=true;
    script.dataset.bozoPaypalSdk='1';
    script.onload=()=>window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error('PayPal SDK loaded without Buttons.'));
    script.onerror=()=>reject(new Error('Could not load the PayPal SDK.'));
    document.head.appendChild(script);
  });
  return bozoPayPalSdkPromise;
}

async function loadBozoPlusCheckout() {
  if (!state.session?.user) return resetBozoPayPalCheckout('Sign in to subscribe with PayPal.');

  const message=$('bozo-paypal-checkout-message');
  if(message) message.textContent='Loading PayPal checkout…';

  try {
    const {data,error}=await sb.functions.invoke('paypal-bozo-subscription',{body:{action:'config'}});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||'Could not load BOZO+ payment configuration.');

    bozoPayPalConfig=data;

    const active=data.subscription;
    const current=$('bozo-paypal-current-subscription');
    if(active && current) {
      current.hidden=false;
      current.innerHTML=`<b>PayPal subscription: ${escapeHtml(active.status)}</b><span>${escapeHtml(bozoPlanLabel(active.plan_key))} · ${escapeHtml(active.paypal_subscription_id)}</span>`;
    }

    if (active?.status === 'ACTIVE') {
      ['paypal-monthly-button','paypal-annual-button'].forEach(id=>{ if($(id)) $(id).innerHTML=''; });
      if(message) message.textContent='Your PayPal BOZO+ subscription is active.';
      return;
    }

    const paypalSdk=await loadPayPalSubscriptionSdk(data.client_id);
    const renderKey=`${data.monthly_plan_id}:${data.annual_plan_id}:${state.session.user.id}`;
    if(bozoPayPalRenderedKey===renderKey) return;
    bozoPayPalRenderedKey=renderKey;

    await renderBozoPayPalButton(paypalSdk,'paypal-monthly-button','monthly',data.monthly_plan_id);
    await renderBozoPayPalButton(paypalSdk,'paypal-annual-button','annual',data.annual_plan_id);
    if(message) message.textContent=data.environment==='sandbox'
      ? 'Sandbox checkout is ready. Use a PayPal Sandbox personal buyer account. No real money will move.'
      : 'LIVE checkout is ready. Purchases here use real money and create a real recurring PayPal subscription.';
  } catch(error) {
    bozoPayPalRenderedKey='';
    if(message) message.textContent=readableError(error);
  }
}

async function renderBozoPayPalButton(paypalSdk,containerId,planKey,planId) {
  const container=$(containerId);
  if(!container || !planId) return;
  container.innerHTML='';

  await paypalSdk.Buttons({
    style:{shape:'rect',layout:'vertical',label:'subscribe',height:42},
    createSubscription(_data,actions) {
      return actions.subscription.create({
        plan_id:planId,
        custom_id:state.session.user.id
      });
    },
    async onApprove(data) {
      const message=$('bozo-paypal-checkout-message');
      if(message) message.textContent='PayPal approved. Verifying your subscription with BOZO…';
      try{
        const {data:verified,error}=await sb.functions.invoke('paypal-bozo-subscription',{
          body:{action:'verify',subscriptionId:data.subscriptionID,expectedPlan:planKey}
        });
        if(error) throw error;
        if(!verified?.ok) throw new Error(verified?.error||'Subscription verification failed.');
        if(!verified.active) throw new Error(`PayPal returned ${verified.status}. BOZO+ will activate when PayPal reports ACTIVE.`);
        await loadIdentity();
        renderBozoPlusPage();
        renderProfile();
        toast('BOZO+ activated through PayPal Sandbox');
      }catch(error){
        if(message) message.textContent=readableError(error);
      }
    },
    onCancel() {
      const message=$('bozo-paypal-checkout-message');
      if(message) message.textContent='PayPal checkout was cancelled.';
    },
    onError(error) {
      console.error('PayPal BOZO+ checkout:',error);
      const message=$('bozo-paypal-checkout-message');
      if(message) message.textContent='PayPal checkout failed. Try again or check the browser console.';
    }
  }).render(`#${containerId}`);
}

async function initializeBozoPayPalSandbox() {
  const button=$('bozo-paypal-initialize'),output=$('bozo-paypal-setup-result');
  if(!button||!output)return;
  if(state.role!=='owner'){output.textContent='Owner access required.';return;}
  button.disabled=true;button.textContent='Connecting…';output.textContent='Checking PayPal plans and webhook…';
  try{
    const {data,error}=await sb.functions.invoke('paypal-bozo-setup',{body:{action:'ensure_all'}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'PayPal setup failed.');
    output.textContent=`Product: ${data.product_id}\nMonthly: ${data.monthly_plan_id}\nAnnual: ${data.annual_plan_id}\nWebhook: ${data.webhook_id||'not created'}\nEnvironment: ${data.environment}`;
    toast(data.environment==='live' ? 'PayPal Live backend is ready' : 'PayPal Sandbox backend is ready');
    await loadBozoPlusCheckout();
  }catch(error){output.textContent=readableError(error);}
  finally{button.disabled=false;button.textContent=bozoPayPalConfig?.environment==='live' ? 'Initialize PayPal Live' : 'Finish PayPal Sandbox setup';}
}
$('bozo-paypal-initialize')?.addEventListener('click',initializeBozoPayPalSandbox);


/* ============================================================
   BOZO v4.7.0: post-game loop, notifications, BOZO+ management
   ============================================================ */
const bozoNoticeSeen = new Set(JSON.parse(localStorage.getItem('bozo_notice_seen') || '[]'));
function rememberBozoNotice(key){ bozoNoticeSeen.add(key); localStorage.setItem('bozo_notice_seen', JSON.stringify([...bozoNoticeSeen].slice(-100))); }
function noticeTime(value){ try{return new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return''} }
function renderNotificationItems(items=[]){
  const list=$('notification-list'), count=$('notification-count'); if(!list||!count)return;
  const fresh=items.filter(i=>!bozoNoticeSeen.has(i.key)); count.hidden=!fresh.length; count.textContent=String(fresh.length);
  list.innerHTML=items.length?items.map(i=>`<button class="notification-item ${bozoNoticeSeen.has(i.key)?'':'unread'}" type="button" data-notice-key="${escapeHtml(i.key)}" data-notice-route="${escapeHtml(i.route||'')}"><span class="notification-dot"></span><span><b>${escapeHtml(i.title)}</b><small>${escapeHtml(i.body||'')}</small><em>${escapeHtml(i.when||'')}</em></span></button>`).join(''):'<div class="empty-state mini"><span>Nothing new.</span></div>';
  list.querySelectorAll('[data-notice-key]').forEach(btn=>btn.addEventListener('click',()=>{ rememberBozoNotice(btn.dataset.noticeKey); if(btn.dataset.noticeRoute)route(btn.dataset.noticeRoute); closeNotificationPopover(); loadBozoNotifications(); }));
}
async function loadBozoNotifications(){
  if(!state.session?.user)return renderNotificationItems([]);
  const items=[];
  try{
    const {data,error}=await sb.rpc('my_opening_challenges');
    if(!error){ (data||[]).filter(c=>c.status==='pending'&&c.opponent_id===state.session.user.id).slice(0,8).forEach(c=>items.push({key:`challenge:${c.id}`,title:'Opening challenge',body:`${c.challenger_ign||c.challenger_username||'A player'} challenged you to ${c.opening_name||'an opening duel'}.`,when:noticeTime(c.created_at),route:'challenges'})); }
  }catch(_){}
  if(isBozoSupporter() && !bozoNoticeSeen.has('bozoplus:active')) items.push({key:'bozoplus:active',title:'BOZO+ is active',body:'Your supporter cosmetics are unlocked.',when:'Account',route:'bozoplus'});
  if(ratedMatchSession?.rematch_offer_by && ratedMatchSession.rematch_offer_by!==state.session.user.id) items.unshift({key:`rematch:${ratedMatchSession.id}:${ratedMatchSession.rematch_offer_at||''}`,title:'Rematch requested',body:`${ratedMatchSession.opponent_username||'Your opponent'} wants another game.`,when:'Now',route:'play'});
  renderNotificationItems(items);
}
function closeNotificationPopover(){ const p=$('notification-popover'),b=$('notification-bell'); if(p)p.hidden=true;if(b)b.setAttribute('aria-expanded','false'); }
$('notification-bell')?.addEventListener('click',e=>{e.stopPropagation();const p=$('notification-popover');if(!p)return;p.hidden=!p.hidden;$('notification-bell').setAttribute('aria-expanded',p.hidden?'false':'true');if(!p.hidden)loadBozoNotifications();});
$('notification-refresh')?.addEventListener('click',loadBozoNotifications);
document.addEventListener('click',e=>{if(!e.target.closest('.notification-menu'))closeNotificationPopover();});
function maybeNotifyRatedRematch(){ if(ratedMatchSession?.rematch_offer_by&&ratedMatchSession.rematch_offer_by!==state.session?.user?.id)loadBozoNotifications(); }

async function loadDashboardGameLoop(){
  if(!state.session?.user||!$('dashboard-recent-games'))return;
  try{
    const profile=await loadChessProfile(null); const games=profile?.games||[], ratings=profile?.ratings||[];
    const rapid=ratings.find(r=>r.pool==='rapid')||ratings.find(r=>r.is_established)||ratings[0];
    $('dashboard-current-rating').textContent=rapid?(rapid.display_rating??Math.round(Number(rapid.rating||0))):' - '; $('dashboard-current-pool').textContent=rapid?prettyPool(rapid.pool):'No rating';
    const five=games.slice(0,5); let w=0,d=0,l=0; five.forEach(g=>{const r=resultForPerspective(g);if(r.tone==='win')w++;else if(r.tone==='draw')d++;else l++;});
    $('dashboard-last-five').textContent=five.length?`${w}W ${d}D ${l}L`:' - '; $('dashboard-last-five-label').textContent=five.length?`${five.length} recent rated games`:'No rated games yet';
    const recent=games[0]; $('dashboard-recent-opponent').textContent=recent?(recent.opponent_ign||recent.opponent_username||'Opponent'):' - '; $('dashboard-recent-result').textContent=recent?`${resultForPerspective(recent).label} · ${prettyPool(recent.pool)}`:'No rated games yet';
    $('dashboard-recent-games').innerHTML=gameHistoryMarkup(games,5,'No rated games yet.');
  }catch(error){ $('dashboard-recent-games').innerHTML=`<div class="empty-state mini"><span>${escapeHtml(readableError(error))}</span></div>`; }
}
$('dashboard-view-games')?.addEventListener('click',()=>{route('profile');setTimeout(()=>document.querySelector('[data-profile-tab="games"]')?.click(),50);});

async function loadBozoPlusManage(){
  const box=$('bozo-plus-manage-status'); if(!box||!state.session?.user)return;
  try{ const {data,error}=await sb.functions.invoke('paypal-bozo-subscription',{body:{action:'config'}}); if(error)throw error; const sub=data?.subscription;
    box.innerHTML=`<div><span>Status</span><b>${escapeHtml(sub?.status|| (isBozoSupporter()?'Active (manual/supporter)':'Not subscribed'))}</b></div><div><span>Plan</span><b>${escapeHtml(sub?.plan_key?bozoPlanLabel(sub.plan_key):' - ')}</b></div><div><span>Subscription</span><b>${escapeHtml(sub?.paypal_subscription_id||' - ')}</b></div>`;
  }catch(error){box.innerHTML=`<div><span>Status</span><b>Could not load PayPal status</b></div><div><span>Plan</span><b> - </b></div><div><span>Subscription</span><b> - </b></div>`;}
}
$('bozo-plus-refresh-status')?.addEventListener('click',loadBozoPlusManage);

function closePostGameSummary(){if($('postgame-modal'))$('postgame-modal').hidden=true;}

function closeCompletedPlayOverlays() {
  closePostGameSummary();

  // A rated game and BOZO Bot share the bot-game modal. Once the user leaves
  // a completed game for Review, clean up the live surface completely.
  if ($('bot-game-modal') && !$('bot-game-modal').hidden) {
    try { closeWebBotGame(); }
    catch (error) {
      console.warn('Could not fully clean up gameplay modal:', error);
      $('bot-game-modal').hidden = true;
      stopRatedMatchPolling?.();
      stopRatedClockRenderer?.();
    }
  }

  // Defensive cleanup for any queue UI still left behind.
  try { resetMatchmakingUi(); } catch (_) {}
}
async function showRatedPostGameSummary(session){
  if(!session||!$('postgame-modal'))return; let latest=null;
  try{const cp=await loadChessProfile(null); latest=cp?.games?.[0]||null;}catch(_){}
  const perspective=latest?resultForPerspective(latest):null;
  const myWhite=session.myColor==='w'; const won=(session.result==='1-0'&&myWhite)||(session.result==='0-1'&&!myWhite); const draw=session.result==='1/2-1/2';
  const label=perspective?.label||(draw?'Draw':won?'Win':'Loss');
  $('postgame-title').textContent=label==='Win'?'You won.':label==='Draw'?'Game drawn.':'Game over.'; $('postgame-subtitle').textContent=`${prettyPool(session.pool||latest?.pool||'rated')} · ${session.opponent_username||latest?.opponent_username||'Opponent'}`;
  $('postgame-result').textContent=label; $('postgame-rating').textContent=latest?.rating_after!=null?Math.round(Number(latest.rating_after)):(session.my_display_rating||' - ');
  const delta=latest?.rating_change; $('postgame-delta').textContent=delta==null?' - ':`${Number(delta)>=0?'+':''}${Number(delta)}`;
  $('postgame-opening').textContent=latest?.opening_name||'Review to identify'; $('postgame-review').dataset.gameId=latest?.id||session.rated_game_id||''; $('postgame-rematch').hidden=false; $('postgame-modal').hidden=false;
}

/* BOZO v4.7.2: delegated post-game controls
   The modal markup is after app.js in index.html, so direct listeners attached at
   startup could silently miss these elements. Delegation works regardless of DOM order. */
document.addEventListener('click', async (event) => {
  const closeTarget = event.target.closest('[data-postgame-close]');
  if (closeTarget) {
    event.preventDefault();
    closePostGameSummary();
    return;
  }

  const reviewButton = event.target.closest('#postgame-review');
  if (reviewButton) {
    event.preventDefault();
    if (reviewButton.disabled) return;
    reviewButton.disabled = true;
    reviewButton.textContent = 'Opening review…';

    try {
      const id = reviewButton.dataset.gameId || '';
      let game = id ? historyGameById(id) : null;

      if (!game?.pgn) {
        try {
          myChessProfile = await loadChessProfile(null) || { ratings: [], games: [] };
          game = id ? historyGameById(id) : myChessProfile.games?.[0];
        } catch (_) {}
      }

      closeCompletedPlayOverlays();
      route('review');

      if (game?.pgn) {
        setTimeout(() => {
          const input = $('review-pgn-input');
          if (input) input.value = normalizeRatedReviewPgn(game);

          const message = $('review-import-message');
          if (message) {
            message.textContent =
              `Rated game vs @${game.opponent_username || 'opponent'} loaded with clean BOZO match headers.`;
          }

          input?.scrollIntoView({ behavior:'smooth', block:'center' });
        }, 150);
      } else {
        toast('Game history is still settling. Open Game History in a moment to review it.');
      }
    } catch (error) {
      console.error('Postgame review failed:', error);
      toast(error?.message || 'Could not open this game in Review.');
    } finally {
      reviewButton.disabled = false;
      reviewButton.textContent = 'Review game';
    }
    return;
  }

  const rematchButton = event.target.closest('#postgame-rematch');
  if (rematchButton) {
    event.preventDefault();
    if (rematchButton.disabled) return;
    rematchButton.disabled = true;
    rematchButton.textContent = 'Sending…';

    try {
      if (!ratedMatchSession?.id) {
        closePostGameSummary();
        route('play');
        toast('Open Play to challenge your opponent again.');
        return;
      }

      const data = await ratedMatchAction('offer-rematch');
      if (!data) return;

      ratedMatchSession.rematch_offer_by = state.session.user.id;
      ratedMatchSession.rematch_offer_at = new Date().toISOString();

      closePostGameSummary();
      openRatedMatchModal();
      updateRatedNegotiationUI();
      toast('Rematch offered. Waiting for your opponent.');
    } catch (error) {
      console.error('Postgame rematch failed:', error);
      toast(error?.message || 'Could not send the rematch offer.');
    } finally {
      rematchButton.disabled = false;
      rematchButton.textContent = 'Rematch';
    }
    return;
  }
});

setTimeout(()=>{if(state.session?.user)loadBozoNotifications();},250);



document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if ($('create-club-modal') && !$('create-club-modal').hidden) $('create-club-modal').hidden = true;
  if ($('create-arena-modal') && !$('create-arena-modal').hidden) $('create-arena-modal').hidden = true;
});


function closeOverlayModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('hidden','');
}

document.addEventListener('click', (event) => {
  const target = event.target.closest?.('#close-create-club,#close-create-arena');
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  closeOverlayModal(target.id === 'close-create-club' ? 'create-club-modal' : 'create-arena-modal');
}, true);


document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if ($('club-detail-modal') && !$('club-detail-modal').hidden) closeClubDetail();
  if ($('arena-detail-modal') && !$('arena-detail-modal').hidden) closeArenaDetail();
});

/* ============================================================
   BOZO v4.13.0: Connect: DMs, Ask BOZO, unified notifications
   ============================================================ */
let bozoCommsTab='messages', bozoCommsThread=null, bozoCommsTimer=null;
function commsSignedIn(){if(state.session?.user)return true;openAuth();toast('Sign in to use BOZO Connect');return false;}
function commsEmpty(title,body){return `<div class="comms-empty"><img src="./assets/bozo-scholar.png" alt="BOZO"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;}
function closeComms(){const d=$('comms-drawer'),b=$('comms-backdrop');if(d)d.hidden=true;if(b)b.hidden=true;bozoCommsThread=null;if(bozoCommsTimer){clearInterval(bozoCommsTimer);bozoCommsTimer=null;}}
async function openComms(tab='messages'){if(!commsSignedIn())return;bozoCommsTab=tab;const d=$('comms-drawer'),b=$('comms-backdrop');if(d)d.hidden=false;if(b)b.hidden=false;$$('[data-comms-tab]').forEach(x=>x.classList.toggle('active',x.dataset.commsTab===tab));$('comms-title').textContent=tab==='support'?'Ask BOZO':tab==='notifications'?'Notifications':'Messages';await renderComms();if(bozoCommsTimer)clearInterval(bozoCommsTimer);bozoCommsTimer=setInterval(()=>{if(!$('comms-drawer')?.hidden)renderComms(false)},15000);}
async function renderComms(showLoading=true){const body=$('comms-body');if(!body)return;if(showLoading)body.innerHTML='<div class="empty-state mini"><span>Loading…</span></div>';if(bozoCommsTab==='notifications')return renderCommsNotifications();if(bozoCommsThread)return renderCommsThread(bozoCommsThread);return bozoCommsTab==='support'?renderSupportThreads():renderDmThreads();}
async function renderCommsNotifications(){const body=$('comms-body');await loadBozoNotifications();let q=await sb.from('bozo_notifications').select('*').eq('user_id',state.session.user.id).order('created_at',{ascending:false}).limit(40);if(q.error){body.innerHTML=commsEmpty('Notifications','Run the BOZO Connect Supabase migration to enable communication alerts.');return;}body.innerHTML=q.data?.length?q.data.map(n=>`<button class="comms-thread" data-comms-notice="${n.id}"><div class="comms-thread-head"><b>${escapeHtml(n.title||'Notification')}</b><small>${noticeTime(n.created_at)}</small></div><p>${escapeHtml(n.body||'')}</p></button>`).join(''):commsEmpty('All caught up','Replies, messages, challenges, and other BOZO activity will appear here.');body.querySelectorAll('[data-comms-notice]').forEach(x=>x.onclick=async()=>{await sb.from('bozo_notifications').update({read_at:new Date().toISOString()}).eq('id',x.dataset.commsNotice);await refreshCommsBadges();renderCommsNotifications();});}
async function renderDmThreads(){const body=$('comms-body');const {data,error}=await sb.rpc('bozo_my_dm_threads');if(error){body.innerHTML=commsEmpty('Messages are almost ready','Run SUPABASE_BOZO_CONNECT_V413.sql, then DMs will live here.');return;}body.innerHTML=`<div class="comms-compose"><input id="comms-new-user" placeholder="@username"><button id="comms-new-dm" class="button primary" type="button">New message</button></div>`+(data?.length?data.map(t=>`<button class="comms-thread" data-dm-thread="${t.thread_id}"><div class="comms-thread-head"><b>@${escapeHtml(t.other_username||'player')}</b><small>${noticeTime(t.last_message_at)}</small></div><p>${escapeHtml(t.last_message||'Start a conversation')}</p></button>`).join(''):commsEmpty('No messages yet','Message another BOZO player from their profile, or start one above.'));$('comms-new-dm')?.addEventListener('click',async()=>{const u=($('comms-new-user')?.value||'').trim().replace(/^@/,'');if(!u)return;const prof=await sb.from('profiles').select('id,username').ilike('username',u).limit(1).maybeSingle();if(prof.error)return toast(readableError(prof.error));if(!prof.data?.id)return toast('Player not found');const r=await sb.rpc('bozo_get_or_create_dm_by_user',{p_target_user:prof.data.id});if(r.error)return toast(readableError(r.error));bozoCommsThread={id:r.data,type:'dm',title:'@'+(prof.data.username||u)};renderComms();});body.querySelectorAll('[data-dm-thread]').forEach(x=>x.onclick=()=>{const row=data.find(t=>String(t.thread_id)===x.dataset.dmThread);bozoCommsThread={id:x.dataset.dmThread,type:'dm',title:'@'+(row?.other_username||'player')};renderComms();});}
async function renderSupportThreads(){const body=$('comms-body');const isStaff=['owner','administrator','senior_moderator','moderator'].includes(state.role);const q=isStaff?await sb.from('bozo_support_threads').select('*').order('updated_at',{ascending:false}).limit(60):await sb.from('bozo_support_threads').select('*').eq('user_id',state.session.user.id).order('updated_at',{ascending:false});if(q.error){body.innerHTML=commsEmpty('Ask BOZO is almost ready','Run SUPABASE_BOZO_CONNECT_V413.sql to enable support conversations.');return;}body.innerHTML=`<div class="comms-compose"><button id="comms-new-support" class="button primary" type="button">Ask a new question</button></div>`+(q.data?.length?q.data.map(t=>`<button class="comms-thread" data-support-thread="${t.id}"><div class="comms-thread-head"><b>${escapeHtml(t.subject||'Question for BOZO')}</b><small>${noticeTime(t.updated_at)}</small></div><p>${escapeHtml(t.status||'open')}${isStaff&&t.username?' · @'+escapeHtml(t.username):''}</p></button>`).join(''):commsEmpty('Ask BOZO','Ask about a position, feature, opening, or anything else on the site. We will reply here when we can.'));$('comms-new-support')?.addEventListener('click',()=>renderNewSupport());body.querySelectorAll('[data-support-thread]').forEach(x=>x.onclick=()=>{const row=q.data.find(t=>String(t.id)===x.dataset.supportThread);bozoCommsThread={id:x.dataset.supportThread,type:'support',title:row?.subject||'Ask BOZO'};renderComms();});}
function renderNewSupport(){const body=$('comms-body');body.innerHTML=`<button class="comms-thread" id="comms-back-support">← Back</button><div class="comms-compose"><input id="support-subject" maxlength="120" placeholder="What do you need help with?"><textarea id="support-message" rows="7" maxlength="4000" placeholder="Ask BOZO…"></textarea><small>Page context: ${escapeHtml(location.hash||'#home')}</small><button id="support-send" class="button primary">Send question</button></div>`;$('comms-back-support').onclick=renderSupportThreads;$('support-send').onclick=async()=>{const subject=$('support-subject').value.trim(),message=$('support-message').value.trim();if(!subject||!message)return toast('Add a subject and question');const {data,error}=await sb.rpc('bozo_create_support_thread',{p_subject:subject,p_message:message,p_context:{route:location.hash||'#home'}});if(error)return toast(readableError(error));bozoCommsThread={id:data,type:'support',title:subject};renderComms();};}
async function renderCommsThread(thread){const body=$('comms-body');const table=thread.type==='dm'?'bozo_dm_messages':'bozo_support_messages';const fk=thread.type==='dm'?'thread_id':'thread_id';const {data,error}=await sb.from(table).select('*').eq(fk,thread.id).order('created_at',{ascending:true}).limit(200);if(error){body.innerHTML=commsEmpty('Could not open conversation',readableError(error));return;}body.innerHTML=`<button class="comms-thread" id="comms-thread-back">← Back</button><h3>${escapeHtml(thread.title||'Conversation')}</h3><div class="comms-messages">${(data||[]).map(m=>`<div class="comms-bubble ${m.sender_id===state.session.user.id?'mine':''}">${escapeHtml(m.body||'')}<small>${noticeTime(m.created_at)}</small></div>`).join('')||'<p>No messages yet.</p>'}</div><div class="comms-compose"><textarea id="comms-reply" rows="3" maxlength="4000" placeholder="Write a reply…"></textarea><button id="comms-send" class="button primary">Send</button></div><div class="comms-toolbar">${thread.type==='dm'?'<button id="comms-block">Block user</button><button id="comms-report" class="comms-report">Report conversation</button>':''}</div>`;$('comms-thread-back').onclick=()=>{bozoCommsThread=null;renderComms();};$('comms-send').onclick=async()=>{const text=$('comms-reply').value.trim();if(!text)return;const {error:e}=await sb.from(table).insert({thread_id:thread.id,sender_id:state.session.user.id,body:text});if(e)return toast(readableError(e));$('comms-reply').value='';renderCommsThread(thread);refreshCommsBadges();};if(thread.type==='dm'){$('comms-block').onclick=()=>blockCurrentDm(thread.id);$('comms-report').onclick=()=>reportCurrentDm(thread.id);}}
async function blockCurrentDm(id){if(!confirm('Block this player? They will no longer be able to DM you.'))return;const {error}=await sb.rpc('bozo_block_dm_thread',{p_thread_id:id});if(error)return toast(readableError(error));toast('Player blocked');bozoCommsThread=null;renderDmThreads();}
async function reportCurrentDm(id){const reason=prompt('Briefly tell us what is wrong with this conversation:');if(!reason)return;const {error}=await sb.rpc('bozo_report_dm_thread',{p_thread_id:id,p_reason:reason});if(error)return toast(readableError(error));toast('Report sent to BOZO staff');}
async function refreshCommsBadges(){if(!state.session?.user)return;try{const [n,m,s]=await Promise.all([sb.from('bozo_notifications').select('id',{count:'exact',head:true}).eq('user_id',state.session.user.id).is('read_at',null),sb.rpc('bozo_unread_dm_count'),sb.rpc('bozo_unread_support_count')]);[['comms-notification-badge',n.count||0],['comms-message-badge',Number(m.data||0)],['comms-support-badge',Number(s.data||0)]].forEach(([id,c])=>{const e=$(id);if(e){e.hidden=!c;e.textContent=String(c)}});}catch(_){}}
$$('[data-comms-tab]').forEach(x=>x.addEventListener('click',()=>openComms(x.dataset.commsTab)));$('comms-close')?.addEventListener('click',closeComms);$('comms-backdrop')?.addEventListener('click',closeComms);
$('friend-profile-message')?.addEventListener('click',async()=>{const u=$('friend-profile-challenge')?.dataset.username;if(!u||!commsSignedIn())return;closeFriendProfile();const prof=await sb.from('profiles').select('id,username').ilike('username',u).limit(1).maybeSingle();if(prof.error)return toast(readableError(prof.error));if(!prof.data?.id)return toast('Player not found');const r=await sb.rpc('bozo_get_or_create_dm_by_user',{p_target_user:prof.data.id});if(r.error)return toast(readableError(r.error));bozoCommsThread={id:r.data,type:'dm',title:'@'+(prof.data.username||u)};await openComms('messages');bozoCommsThread={id:r.data,type:'dm',title:'@'+(prof.data.username||u)};renderComms();});
setTimeout(refreshCommsBadges,1800);setInterval(refreshCommsBadges,60000);


// BOZO v4.14.1: Master Database integrations
function openMasterGames(options={}){
  const q=String(options.query||'').trim();
  const contextNote=$('master-context-note'); if(contextNote){contextNote.hidden=true;contextNote.textContent='';}
  route('masters');
  if($('master-search')) $('master-search').value=q;
  if($('master-result-filter')&&options.result!=null) $('master-result-filter').value=options.result;
  if($('master-year-filter')&&options.year!=null) $('master-year-filter').value=options.year;
  loadMasterGames().then(()=>{
    if(options.mode&&masterState.games.length){
      selectMasterGame(masterState.games[0].id).then(()=>{ if(options.mode!=='study') startMasterTraining(options.mode); });
    }
  });
}
async function openMasterGamesForOpening(openingId,name=''){
  const label=String(name||'').trim();
  try{
    const {data,error}=await sb.from('openings').select('id,name,variation,eco,pgn').eq('id',openingId).maybeSingle();
    if(error) throw error;
    if(data?.pgn){
      const g=new Chess(); if(g.load_pgn(data.pgn,{sloppy:true})){
        const key=masterFenKey(g.fen()); route('masters');
        if($('master-search')) $('master-search').value='';
        const note=$('master-context-note'); if(note){note.hidden=false;note.textContent=`Showing games that reached the ${label||data.name||'selected opening'} position, including transpositions.`;}
        return loadMasterGamesByPosition(key,label||data.name||'Opening');
      }
    }
  }catch(error){console.warn('Exact opening/master match failed; falling back to text search.',error);}
  openMasterGames({query:label});
}
window.openMasterGamesForOpening=openMasterGamesForOpening;

// BOZO v4.14.11: Clear stale opening-position context on normal Master Library searches
// BOZO v4.14.10: Scalable Master Library pagination + true result counts
// BOZO v4.14.9: Source-agnostic master header (hide raw source URLs)
// BOZO v4.14.7: Master board row lock + eval bar + PGN titles
// BOZO v4.14.6: Master board sizing + reliable sticky-header reveal
// BOZO v4.14.5: Master viewer viewport fix + full initial import visibility
// BOZO v4.14.3: Opening Library action hierarchy + Master Games polish
// BOZO v4.14.0: Master Games study + training foundation
const MASTER_START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const masterState={games:[],current:null,orientation:'white',ply:0,mode:'study',game:null,selected:null,exact:0,different:0,decisions:[],startedAt:null,locked:false,total:0,offset:0,pageSize:100,loading:false,hasMore:true,queryKey:''};
function masterPieceMarkup(piece){if(!piece)return '';return webPiece(piece.color==='w'?piece.type.toUpperCase():piece.type.toLowerCase());}
function masterSquare(file,rank){return 'abcdefgh'[file]+(8-rank);}
function masterQueryValue(id){return ($(id)?.value||'').trim();}
function masterDisplayDate(v){if(!v)return '';const d=String(v).slice(0,10);return d.replace(/-00/g,'-??');}
function masterVisibleSite(v){const site=String(v||'').trim();if(!site)return '';if(/^https?:\/\//i.test(site)||/^www\./i.test(site))return '';return site;}
function masterGameTitle(g){return `${g.white||'White'} vs. ${g.black||'Black'}`;}
function masterGameSub(g){return [g.event,masterDisplayDate(g.game_date),g.opening||g.eco,g.result].filter(Boolean).join(' · ');}
function masterPgnHeader(game,key){
  const pgn=String(game?.pgn||'');
  const safe=String(key||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=pgn.match(new RegExp('^\\['+safe+'\\s+"([^"]*)"\\]','mi'));
  return match?.[1]?.trim()||'';
}
function masterPlayerMarkup(game,side){
  const name=game?.[side]||(side==='white'?'White':'Black');
  const title=masterPgnHeader(game,side==='white'?'WhiteTitle':'BlackTitle');
  return `${title?`<span class="master-title-badge">${escapeHtml(title)}</span>`:''}<span class="master-player-name">${escapeHtml(name)}</span>`;
}
let masterEvalRequest=0;
const masterEvalState={cp:0,mate:null,ready:false};
function paintMasterEvaluationBar(cp=0,mate=null,loading=false){
  const bar=$('master-eval-bar');if(!bar)return;
  const bounded=mate!=null?(mate>0?1000:-1000):Math.max(-1000,Math.min(1000,Number(cp)||0));
  const whitePct=Math.max(4,Math.min(96,100/(1+Math.exp(-bounded/170))));
  const whiteAtBottom=masterState.orientation!=='black';
  const whiteZone=$('master-eval-white'),blackZone=$('master-eval-black');
  if(whiteZone&&blackZone){
    whiteZone.style.height=`${whitePct}%`;blackZone.style.height=`${100-whitePct}%`;
    whiteZone.style.bottom=whiteAtBottom?'0':'auto';whiteZone.style.top=whiteAtBottom?'auto':'0';
    blackZone.style.top=whiteAtBottom?'0':'auto';blackZone.style.bottom=whiteAtBottom?'auto':'0';
  }
  const top=$('master-eval-top'),bottom=$('master-eval-bottom');
  if(top)top.textContent=whiteAtBottom?'Black':'White';if(bottom)bottom.textContent=whiteAtBottom?'White':'Black';
  const value=$('master-eval-value');if(value){
    value.textContent=loading?'…':mate!=null?`M${Math.abs(mate)}`:`${cp>=0?'+':''}${((Number(cp)||0)/100).toFixed(2)}`;
    const whiteFavored=mate!=null?mate>0:(Number(cp)||0)>=0;
    const favoredAtBottom=whiteAtBottom?whiteFavored:!whiteFavored;
    value.classList.toggle('at-bottom',favoredAtBottom);value.classList.toggle('at-top',!favoredAtBottom);
  }
  bar.classList.toggle('master-eval-loading',!!loading);
}
async function refreshMasterEvaluation(){
  if(!masterState.game)return;
  const request=++masterEvalRequest,fen=masterState.game.fen(),turn=masterState.game.turn();
  paintMasterEvaluationBar(masterEvalState.cp,masterEvalState.mate,true);
  try{
    const engine=await getReviewEngine();const result=await engine.analyze(fen,10);if(request!==masterEvalRequest)return;
    masterEvalState.mate=whiteReviewMate(result,turn);masterEvalState.cp=whiteReviewEval(result,turn);masterEvalState.ready=true;
    paintMasterEvaluationBar(masterEvalState.cp,masterEvalState.mate,false);
  }catch(error){if(request===masterEvalRequest){console.warn('Master eval unavailable',error);paintMasterEvaluationBar(masterEvalState.cp,masterEvalState.mate,false);}}
}
async function loadMasterGames(options={}){
  const list=$('master-game-list'); if(!list)return;
  const append=!!options.append;

  // BOZO v4.14.11: normal Master Library searches must not keep
  // stale opening-position context from a previous exact-position lookup.
  if(!append){
    const contextNote=$('master-context-note');
    if(contextNote){
      contextNote.hidden=true;
      contextNote.textContent='';
    }
  }
  const q=masterQueryValue('master-search'), year=masterQueryValue('master-year-filter'), result=masterQueryValue('master-result-filter');
  const queryKey=JSON.stringify([q,year,result]);
  if(masterState.loading)return;
  if(!append||queryKey!==masterState.queryKey){
    masterState.queryKey=queryKey;masterState.offset=0;masterState.total=0;masterState.hasMore=true;masterState.games=[];
    list.innerHTML='<div class="empty-state"><div>♟</div><b>Loading master games…</b></div>';
  }
  if(!masterState.hasMore&&append)return;
  masterState.loading=true;
  try{
    const args={p_query:q||null,p_year:year?Number(year):null,p_result:result||null};
    const jobs=[sb.rpc('search_master_games_page',{...args,p_limit:masterState.pageSize,p_offset:masterState.offset})];
    if(!append)jobs.push(sb.rpc('count_master_games',args));
    const results=await Promise.all(jobs), pageResult=results[0];
    if(pageResult.error)throw pageResult.error;
    if(!append){
      const countResult=results[1];if(countResult?.error)throw countResult.error;
      masterState.total=Number(countResult?.data||0);
    }
    const page=pageResult.data||[];
    if(append){
      const seen=new Set(masterState.games.map(g=>String(g.id)));
      masterState.games.push(...page.filter(g=>!seen.has(String(g.id))));
    }else masterState.games=page;
    masterState.offset=masterState.games.length;
    masterState.hasMore=masterState.offset<masterState.total&&page.length>0;
    $('master-count').textContent=String(masterState.total);
    renderMasterGameList();
    if(masterState.current){const newer=masterState.games.find(x=>x.id===masterState.current.id);if(newer)masterState.current=newer;}
  }catch(error){
    if(!append)list.innerHTML=`<div class="empty-state"><div>♜</div><b>Master Database needs setup</b><span>${escapeHtml(readableError(error))}</span></div>`;
    else toast(`Could not load more master games: ${readableError(error)}`);
  }finally{masterState.loading=false;}
}
function renderMasterGameList(){
  const list=$('master-game-list');if(!list)return;
  if(!masterState.games.length){list.innerHTML='<div class="empty-state"><div>♟</div><b>No games found</b><span>Try another search, or import PGNs from the Owner\'s Office.</span></div>';return;}
  const rows=masterState.games.map(g=>{const wt=masterPgnHeader(g,'WhiteTitle'),bt=masterPgnHeader(g,'BlackTitle');return `<button class="master-game-row ${masterState.current?.id===g.id?'active':''}" data-master-id="${g.id}" type="button"><strong>${wt?`<span class="master-title-badge">${escapeHtml(wt)}</span>`:''}${escapeHtml(g.white||'White')} <em>${escapeHtml(g.result||'*')}</em> ${bt?`<span class="master-title-badge">${escapeHtml(bt)}</span>`:''}${escapeHtml(g.black||'Black')}</strong><span>${escapeHtml(masterGameSub(g))}</span></button>`;}).join('');
  const status=`<div class="master-list-status" data-master-list-status>${masterState.hasMore?`Loaded ${masterState.games.length.toLocaleString()} of ${masterState.total.toLocaleString()} · scroll for more`:`${masterState.total.toLocaleString()} game${masterState.total===1?'':'s'}`}</div>`;
  list.innerHTML=rows+status;
  list.querySelectorAll('[data-master-id]').forEach(b=>b.onclick=()=>selectMasterGame(b.dataset.masterId));
}
function masterRevealViewerHeader(){
  const viewer=document.querySelector('#view-masters .master-viewer');
  if(!viewer)return;
  requestAnimationFrame(()=>viewer.scrollIntoView({block:'start',behavior:'smooth'}));
}
async function selectMasterGame(id){
  let game=masterState.games.find(x=>String(x.id)===String(id));
  if(!game){const {data,error}=await sb.from('bozo_master_games').select('*').eq('id',id).single();if(error)return toast(readableError(error));game=data;}
  masterState.current=game;masterState.orientation='white';masterState.mode='study';masterState.ply=0;masterState.selected=null;masterState.exact=0;masterState.different=0;masterState.decisions=[];masterState.locked=false;
  $('master-empty').hidden=true;$('master-active').hidden=false;$('master-finish-card').hidden=true;$('master-training-card').hidden=true;
  $('master-event').textContent=game.event||'MASTER GAME';$('master-white').innerHTML=masterPlayerMarkup(game,'white');$('master-black').innerHTML=masterPlayerMarkup(game,'black');$('master-result').textContent=game.result||'*';$('master-opening').textContent=[game.eco,game.opening].filter(Boolean).join(' · ');$('master-details').textContent=[game.white_elo?`${game.white_elo}`:'',game.black_elo?`${game.black_elo}`:'',masterDisplayDate(game.game_date),masterVisibleSite(game.site)].filter(Boolean).join(' · ');masterEvalState.cp=0;masterEvalState.mate=null;masterEvalState.ready=false;
  document.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('active',x.dataset.masterMode==='study'));
  masterSetStudyPly(0);renderMasterGameList();masterRevealViewerHeader();
}
function masterMovesSan(){return Array.isArray(masterState.current?.moves_san)?masterState.current.moves_san:[];}
function masterMovesUci(){return Array.isArray(masterState.current?.moves_uci)?masterState.current.moves_uci:[];}
function masterBuildGame(ply=0){
  const start=masterState.current?.starting_fen||MASTER_START_FEN;let g;try{g=new Chess(start);}catch{g=new Chess();}
  const moves=masterMovesSan();for(let i=0;i<Math.min(ply,moves.length);i++){try{const m=g.move(moves[i],{sloppy:true});if(!m)break;}catch{break;}}
  return g;
}
function masterSetStudyPly(ply){if(!masterState.current)return;const max=masterMovesSan().length;masterState.ply=Math.max(0,Math.min(max,Number(ply)||0));masterState.game=masterBuildGame(masterState.ply);masterState.selected=null;paintMasterBoard();paintMasterMoves();paintMasterPly();refreshMasterEvaluation();}
function paintMasterPly(){if($('master-ply-label'))$('master-ply-label').textContent=`${masterState.ply} / ${masterMovesSan().length}`;}
function paintMasterBoard(){
  const board=$('master-game-board');if(!board||!masterState.game)return;
  const black=masterState.orientation==='black',ranks=black?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],files=black?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  board.innerHTML=ranks.flatMap(r=>files.map(f=>{const sq=masterSquare(f,r),piece=masterState.game.get(sq);return `<button type="button" class="board-square ${(r+f)%2?'dark':'light'} ${masterState.selected===sq?'selected':''}" aria-label="${sq}" data-master-square="${sq}">${masterPieceMarkup(piece)}</button>`;})).join('');
  board.querySelectorAll('[data-master-square]').forEach(b=>b.onclick=()=>masterBoardClick(b.dataset.masterSquare));decorateBozoBoardCoordinates(board);
}
function paintMasterMoves(){
  const root=$('master-move-list');if(!root)return;const moves=masterMovesSan();let html='';
  for(let i=0;i<moves.length;i+=2){const no=i/2+1,current=masterState.ply===i+1||masterState.ply===i+2;html+=`<div class="master-move-pair ${current?'current':''}"><b>${no}.</b><button class="master-move" data-master-ply="${i+1}">${escapeHtml(moves[i]||'')}</button><button class="master-move" data-master-ply="${i+2}" ${moves[i+1]?'':'disabled'}>${escapeHtml(moves[i+1]||'')}</button></div>`;}
  root.innerHTML=html||'<span class="muted">No moves stored.</span>';root.querySelectorAll('[data-master-ply]').forEach(b=>b.onclick=()=>{if(masterState.mode==='study')masterSetStudyPly(Number(b.dataset.masterPly));});
  root.querySelector('.current')?.scrollIntoView({block:'nearest'});
}
function masterUserTurn(){if(!masterState.game)return false;const turn=masterState.game.turn();return masterState.mode==='both'||(masterState.mode==='white'&&turn==='w')||(masterState.mode==='black'&&turn==='b');}
function masterBoardClick(sq){
  if(masterState.mode==='study'||masterState.locked||!masterState.current||!masterState.game||!masterUserTurn())return;
  const piece=masterState.game.get(sq),turn=masterState.game.turn();
  if(!masterState.selected){if(piece&&piece.color===turn){masterState.selected=sq;paintMasterBoard();}return;}
  if(piece&&piece.color===turn){masterState.selected=sq;paintMasterBoard();return;}
  const from=masterState.selected;masterState.selected=null;let move=null;try{move=masterState.game.move({from,to:sq,promotion:'q'});}catch{}
  if(!move){paintMasterBoard();return;}
  const played=(move.from+move.to+(move.promotion||'')).toLowerCase(),expected=String(masterMovesUci()[masterState.ply]||'').toLowerCase(),sanPlayed=move.san||played,masterSan=masterMovesSan()[masterState.ply]||expected,exact=played===expected;
  masterState.decisions.push({ply:masterState.ply+1,played_uci:played,played_san:sanPlayed,master_uci:expected,master_san:masterSan,exact});
  if(exact){masterState.exact++;masterState.ply++;$('master-training-feedback').textContent=`Master move ✓ ${masterSan}`;paintMasterBoard();paintMasterMoves();paintMasterPly();setTimeout(masterAutoAdvanceTraining,320);}
  else{masterState.different++;masterState.locked=true;$('master-training-feedback').textContent=`Playable choice recorded. The game continuation was ${masterSan}.`;paintMasterBoard();setTimeout(()=>{masterState.game.undo();try{masterState.game.move(masterSan,{sloppy:true});}catch{}masterState.ply++;masterState.locked=false;paintMasterBoard();paintMasterMoves();paintMasterPly();refreshMasterEvaluation();masterAutoAdvanceTraining();},720);}
  masterUpdateTrainingStats();
}
function masterUpdateTrainingStats(){if($('master-exact'))$('master-exact').textContent=masterState.exact;if($('master-different'))$('master-different').textContent=masterState.different;}
function masterAutoAdvanceTraining(){
  if(masterState.mode==='study'||!masterState.current)return;const moves=masterMovesSan();
  while(masterState.ply<moves.length&&!masterUserTurn()){try{const m=masterState.game.move(moves[masterState.ply],{sloppy:true});if(!m)break;}catch{break;}masterState.ply++;}
  paintMasterBoard();paintMasterMoves();paintMasterPly();refreshMasterEvaluation();if(masterState.ply>=moves.length)return finishMasterTraining();
  const side=masterState.game.turn()==='w'?'White':'Black';$('master-training-title').textContent=`${side} to move`;
}
function startMasterTraining(mode){
  if(!masterState.current)return;masterState.mode=mode;masterState.game=masterBuildGame(0);masterState.ply=0;masterState.selected=null;masterState.exact=0;masterState.different=0;masterState.decisions=[];masterState.startedAt=new Date().toISOString();masterState.locked=false;$('master-training-card').hidden=false;$('master-finish-card').hidden=true;document.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('active',x.dataset.masterMode===mode));$('master-training-feedback').textContent='Find the move played in the game. Different legal moves are recorded as alternatives, not automatically called blunders.';masterUpdateTrainingStats();masterAutoAdvanceTraining();
}
async function finishMasterTraining(){
  const total=masterState.exact+masterState.different,rate=total?Math.round(masterState.exact/total*100):0;const card=$('master-finish-card');card.hidden=false;card.innerHTML=`<span class="eyebrow">GAME COMPLETE</span><h3>${escapeHtml(masterGameTitle(masterState.current))}</h3><p><b>${rate}%</b> master-move match · ${masterState.exact} exact · ${masterState.different} alternatives</p><button id="master-review-study" class="button primary" type="button">Review game</button>`;$('master-training-feedback').textContent='Training complete.';
  if(state.session){const payload={user_id:state.session.user.id,game_id:masterState.current.id,training_side:masterState.mode,master_matches:masterState.exact,alternative_moves:masterState.different,total_decisions:total,match_percent:rate,decisions:masterState.decisions,started_at:masterState.startedAt,completed_at:new Date().toISOString()};const {error}=await sb.from('bozo_master_training_runs').insert(payload);if(error)console.warn('Master training save failed',error);}
  $('master-review-study')?.addEventListener('click',()=>{masterState.mode='study';document.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('active',x.dataset.masterMode==='study'));$('master-training-card').hidden=true;masterSetStudyPly(masterMovesSan().length);});
}
function masterParseHeaders(pgn){const h={};String(pgn).replace(/^\s*\[([^\s]+)\s+"([^"]*)"\]\s*$/gm,(_,k,v)=>(h[k]=v,''));return h;}
function masterSplitPgns(text){const cleaned=String(text||'').replace(/\r/g,'').trim();if(!cleaned)return[];const starts=[];const re=/(^|\n)\s*\[Event\s+"/g;let m;while((m=re.exec(cleaned)))starts.push(m.index+(m[1]?1:0));if(starts.length<=1)return[cleaned];const out=[];for(let i=0;i<starts.length;i++)out.push(cleaned.slice(starts[i],starts[i+1]||cleaned.length).trim());return out.filter(Boolean);}
function masterCleanPgn(headers,sanMoves){const keys=['Event','Site','Date','Round','White','Black','Result','WhiteElo','BlackElo','ECO','Opening','FEN','SetUp'];const lines=keys.filter(k=>headers[k]).map(k=>`[${k} "${String(headers[k]).replace(/"/g,'')}"]`);let body='';for(let i=0;i<sanMoves.length;i+=2)body+=`${i/2+1}. ${sanMoves[i]||''}${sanMoves[i+1]?' '+sanMoves[i+1]:''} `;body+=(headers.Result||'*');return lines.join('\n')+'\n\n'+body.trim();}
function masterFenKey(fen){return String(fen||'').split(/\s+/).slice(0,4).join(' ');}
async function masterDigest(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function masterParsePgn(pgn,sourceLabel){
  const headers=masterParseHeaders(pgn);let g=new Chess();if(headers.FEN){try{g=new Chess(headers.FEN);}catch{g=new Chess();}}
  try{const loader=new Chess();const ok=loader.load_pgn(pgn,{sloppy:true});if(!ok)throw new Error('Could not parse PGN');g=loader;}catch(e){throw new Error(`PGN parse failed: ${e.message||e}`);}
  const hist=g.history({verbose:true});if(!hist.length)throw new Error('PGN contains no moves');const start=headers.FEN||MASTER_START_FEN;let replay;try{replay=new Chess(start);}catch{replay=new Chess();}
  const san=[],uci=[],positions=[];for(let i=0;i<hist.length;i++){const src=hist[i];let mv;try{mv=replay.move(src.san,{sloppy:true});}catch{}if(!mv)throw new Error(`Could not replay move ${i+1}`);san.push(mv.san);uci.push((mv.from+mv.to+(mv.promotion||'')).toLowerCase());positions.push({ply:i+1,fen:replay.fen(),fen_key:masterFenKey(replay.fen()),san:mv.san,uci:uci[uci.length-1]});}
  const clean=masterCleanPgn(headers,san),key=await masterDigest([headers.White||'',headers.Black||'',headers.Date||'',uci.join(' ')].join('|'));
  return {game_key:key,white:headers.White||'Unknown',black:headers.Black||'Unknown',white_elo:Number(headers.WhiteElo)||null,black_elo:Number(headers.BlackElo)||null,event:headers.Event||'',site:headers.Site||'',game_date:/^\d{4}\.\d{2}\.\d{2}$/.test(headers.Date||'')?headers.Date.replace(/\./g,'-'):null,game_year:Number((headers.Date||'').slice(0,4))||null,round:headers.Round||'',result:headers.Result||'*',eco:headers.ECO||'',opening:headers.Opening||'',starting_fen:start,moves_san:san,moves_uci:uci,move_count:san.length,pgn:clean,source_label:sourceLabel||'Public PGN',positions};
}
async function importMasterPgnFromOwner(){
  if(state.role!=='owner')return toast('Owner access required.');const status=$('master-import-status'),text=$('master-import-pgn').value,source=$('master-import-source').value.trim()||'Public PGN',blocks=masterSplitPgns(text);if(!blocks.length)return toast('Paste at least one PGN.');$('master-import-run').disabled=true;let ok=0,failed=0;status.textContent=`Preparing ${blocks.length} game(s)…`;
  for(let i=0;i<blocks.length;i++){try{const parsed=await masterParsePgn(blocks[i],source),positions=parsed.positions;delete parsed.positions;const {data,error}=await sb.from('bozo_master_games').upsert(parsed,{onConflict:'game_key'}).select('id').single();if(error)throw error;await sb.from('bozo_master_game_positions').delete().eq('game_id',data.id);for(let j=0;j<positions.length;j+=200){const rows=positions.slice(j,j+200).map(x=>({...x,game_id:data.id}));const {error:pe}=await sb.from('bozo_master_game_positions').insert(rows);if(pe)throw pe;}ok++;status.textContent=`Imported ${ok}/${blocks.length}…`; }catch(e){failed++;status.textContent+=`\nGame ${i+1}: ${readableError(e)}`;}}
  $('master-import-run').disabled=false;status.textContent+=`\nDone. ${ok} imported, ${failed} failed.`;
}


async function loadMasterGamesByPosition(fenKey,label='Opening'){
  const list=$('master-game-list'); if(!list)return;
  list.innerHTML='<div class="empty-state"><div>♟</div><b>Finding games that reached this position…</b></div>';
  const {data,error}=await sb.rpc('master_games_reaching_position',{p_fen_key:fenKey,p_limit:120});
  if(error){list.innerHTML=`<div class="empty-state"><div>⚠</div><b>Could not match this opening</b><span>${escapeHtml(readableError(error))}</span></div>`;return;}
  masterState.games=data||[]; masterState.current=null; $('master-count').textContent=String(masterState.games.length); renderMasterGameList();
  const note=$('master-context-note'); if(note){note.hidden=false;note.textContent=`${masterState.games.length} game${masterState.games.length===1?'':'s'} reached the ${label} position. Position matching includes transpositions even when the PGN opening label differs.`;}
}

function masterReviewRow(g){
  return `<div class="master-context-row"><div><b>${escapeHtml(masterGameTitle(g))}</b><span>${escapeHtml(masterGameSub(g))}</span></div><div class="master-context-actions"><button class="button secondary" data-review-master-study="${g.id}">Study</button><button class="button primary" data-review-master-load="${g.id}">Load into Game Review</button></div></div>`;
}
async function loadReviewMasterGames(){
  const root=$('review-master-list'); if(!root)return;
  root.innerHTML='<div class="empty-state"><div>♟</div><b>Loading Master Database…</b></div>';
  const q=masterQueryValue('review-master-search'),year=masterQueryValue('review-master-year');
  const {data,error}=await sb.rpc('search_master_games',{p_query:q||null,p_year:year?Number(year):null,p_result:null,p_limit:100});
  if(error){root.innerHTML=`<div class="empty-state"><div>⚠</div><b>Could not load master games</b><span>${escapeHtml(readableError(error))}</span></div>`;return;}
  const rows=data||[];
  root.innerHTML=rows.length?rows.map(masterReviewRow).join(''):'<div class="empty-state"><div>♟</div><b>No master games found</b><span>Try a broader search or import more PGNs.</span></div>';
  root.querySelectorAll('[data-review-master-study]').forEach(b=>b.onclick=()=>{route('masters');setTimeout(()=>selectMasterGame(b.dataset.reviewMasterStudy),80);});
  root.querySelectorAll('[data-review-master-load]').forEach(b=>b.onclick=()=>loadMasterGameIntoReview(rows.find(g=>String(g.id)===String(b.dataset.reviewMasterLoad))));
}
function loadMasterGameIntoReview(game){
  if(!game?.pgn)return toast('This master game has no PGN attached.');
  document.querySelector('[data-review-mode="game"]')?.click();
  $('review-pgn-input').value=game.pgn;
  const fileName=$('review-file-name'); if(fileName)fileName.textContent=`${game.white||'White'} vs ${game.black||'Black'}`;
  $('review-pgn-input').scrollIntoView({behavior:'smooth',block:'center'});
  toast('Master game loaded. Choose the coaching perspective, then run Game Review.');
}

function masterPuzzleCandidateCard(row,motif){
  return `<div class="master-context-row"><div><b>${escapeHtml(row.white||'White')} vs ${escapeHtml(row.black||'Black')}</b><span>${escapeHtml([row.event,row.game_date,row.opening||row.eco,`move ${Math.floor(Number(row.ply||0)/2)+1}`].filter(Boolean).join(' · '))}</span><div class="master-puzzle-source">Verified idea: ${escapeHtml(motif?.label||'Tactical sequence')}</div></div></div>`;
}
async function findMasterTacticalPuzzle(query=''){
  setTrainMode('master-puzzles');
  const status=$('master-puzzle-status'),preview=$('master-puzzle-preview');
  if(status)status.textContent='Sampling real master-game positions…'; if(preview)preview.innerHTML='';
  const {data,error}=await sb.rpc('sample_master_positions',{p_query:String(query||'').trim()||null,p_game_id:null,p_limit:36});
  if(error){if(status)status.textContent=`Could not sample the database: ${readableError(error)}`;return;}
  const rows=data||[]; if(!rows.length){if(status)status.textContent='No matching master-game positions were found. Import more games or broaden the search.';return;}
  let engine; try{engine=await getReviewEngine();}catch(e){if(status)status.textContent=`Stockfish could not start: ${readableError(e)}`;return;}
  puzzleGeneralMode=false; puzzleMasterSourceMode=false;
  for(let i=0;i<Math.min(rows.length,30);i++){
    const row=rows[i]; if(status)status.textContent=`Checking real position ${i+1}/${Math.min(rows.length,30)} for a concrete tactic…`;
    try{
      const fen=row.fen,side=String(fen).split(/\s+/)[1]==='b'?'black':'white';
      const discovery=await engine.analyzeMultiPv(fen,12,6);
      const quality=await verifyGeneralPuzzleCandidate({fen,userSide:side},discovery,'any');
      if(!quality)continue;
      const bestScore=puzzleEngineScore(quality.lines[0]);
      const candidates=quality.lines.filter(line=>line.pv?.[0]).map(line=>({...line,uci:line.pv[0],loss:Math.max(0,bestScore-puzzleEngineScore(line))})).filter((line,index)=>index===0||line.loss<=PUZZLE_PLAYABLE_CP_WINDOW);
      const solutionPv=(quality.lines[0]?.pv||[]).slice(0,24),inspected=inspectPuzzlePv(fen,quality.lines[0],24);
      const mateLine=quality.motif.key==='mate'||quality.motif.subtype==='mate'||inspected.endedInMate;
      const maxUserMoves=quality.motif.key==='sacrifice'?7:mateLine?8:5;
      const targetUserMoves=Math.max(2,Math.min(maxUserMoves,Math.ceil(solutionPv.length/2)));
      if(preview)preview.innerHTML=masterPuzzleCandidateCard(row,quality.motif);
      if(status)status.textContent='Tactical master-game position verified. Loading puzzle…';
      return activateMasterTacticalPuzzle(row,{fen,userSide:side,candidates,motif:quality.motif,solutionPv,targetUserMoves});
    }catch(e){console.debug('Master position skipped',e);}
  }
  if(status)status.textContent='BOZO sampled these games but did not find a verified tactical position. Try again or broaden the filter.';
}
function activateMasterTacticalPuzzle(row,spec){
  // v4.14.8: a completed master puzzle leaves puzzleCompleting=true. Reset it
  // before activating the next sampled position or board clicks are ignored.
  puzzleCompleting=false;
  puzzleMasterSourceMode=true;puzzleMasterSource=row;puzzleGeneralMode=true;puzzleRunMode='standard';puzzleOpening=null;puzzlePool=[];
  puzzleStats={index:0,total:1,score:0,streak:0,bestStreak:0,userMoves:0,firstTry:0,mistakes:0,skipped:0};
  puzzleRunStrikes=3;puzzleRunHints=3;puzzleRunHintsUsed=0;puzzleRunSolved=0;puzzleRunReviewItems=[];puzzleCurrentReviewItem=null;puzzleResolutionEvals=[];puzzleFailedCurrent=false;
  $('train-master-puzzles-mode').hidden=true;$('train-puzzle-mode').hidden=false;$('puzzle-picker').hidden=true;if($('bozo-puzzle-picker'))$('bozo-puzzle-picker').hidden=true;$('puzzle-results').hidden=true;$('puzzle-session').hidden=false;
  configurePuzzleRunUi();
  puzzleGame=new Chess(spec.fen);puzzleGeneralFen=spec.fen;puzzleGeneralHistory=[];puzzleUserSide=spec.userSide;puzzleMoves=[];puzzleStartPly=0;puzzlePly=0;puzzleTargetUserMoves=spec.targetUserMoves||4;puzzleSolvedInCurrent=0;puzzleSelectedSquare=null;puzzleCurrentDifficulty=0;puzzlePeakDifficulty=0;puzzleCurrentStartedAt=Date.now();puzzleAttemptsForPly=0;puzzleHintUsed=false;puzzleAnswerUsed=false;puzzleCandidateFen=spec.fen;puzzleCandidateMoves=spec.candidates||[];puzzleGeneralMotif=spec.motif?.label||'Tactical sequence';
  puzzleCurrentReviewItem={fen:spec.fen,side:puzzleUserSide,motif:puzzleGeneralMotif,solutionPv:[...(spec.solutionPv||[])],result:'pending',attemptedMove:null,attempts:[],playedLine:[],hintUsed:false};
  $('puzzle-title').textContent='What would you play?';$('puzzle-subtitle').textContent=`${puzzleUserSide[0].toUpperCase()+puzzleUserSide.slice(1)} to move · from ${row.white||'White'} vs ${row.black||'Black'}`;$('puzzle-number').textContent='Master Game Puzzle';$('puzzle-start-label').textContent=`real game · move ${Math.floor(Number(row.ply||0)/2)+1}`;
  setPuzzleFeedback('neutral','Find the tactical idea.','This position came directly from a recorded master game and passed BOZO\'s Stockfish tactical gate.');paintPuzzleBoard();updatePuzzleUI();
}

$('master-search-button')?.addEventListener('click',loadMasterGames);$('master-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')loadMasterGames();});$('master-game-list')?.addEventListener('scroll',e=>{const el=e.currentTarget;if(masterState.loading||!masterState.hasMore)return;if(el.scrollTop+el.clientHeight>=el.scrollHeight-180)loadMasterGames({append:true});});$('master-random')?.addEventListener('click',async()=>{if(!masterState.games.length)await loadMasterGames();if(masterState.games.length)selectMasterGame(masterState.games[Math.floor(Math.random()*masterState.games.length)].id);});$('master-flip')?.addEventListener('click',()=>{masterState.orientation=masterState.orientation==='white'?'black':'white';paintMasterBoard();paintMasterEvaluationBar(masterEvalState.cp,masterEvalState.mate,false);});$('master-start')?.addEventListener('click',()=>{if(masterState.mode==='study')masterSetStudyPly(0);});$('master-prev')?.addEventListener('click',()=>{if(masterState.mode==='study')masterSetStudyPly(masterState.ply-1);});$('master-next')?.addEventListener('click',()=>{if(masterState.mode==='study')masterSetStudyPly(masterState.ply+1);});$('master-end')?.addEventListener('click',()=>{if(masterState.mode==='study')masterSetStudyPly(masterMovesSan().length);});document.querySelectorAll('[data-master-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.masterMode;if(m==='study'){masterState.mode='study';$('master-training-card').hidden=true;$('master-finish-card').hidden=true;document.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('active',x.dataset.masterMode==='study'));masterSetStudyPly(masterState.ply);}else startMasterTraining(m);}));$('master-stop-training')?.addEventListener('click',()=>{masterState.mode='study';$('master-training-card').hidden=true;$('master-finish-card').hidden=true;document.querySelectorAll('[data-master-mode]').forEach(x=>x.classList.toggle('active',x.dataset.masterMode==='study'));masterSetStudyPly(masterState.ply);});



// BOZO v4.14.1 integration entry points
$('library-master-games')?.addEventListener('click',()=>openMasterGames({query:$('opening-search-input')?.value||''}));
$('train-master-games')?.addEventListener('click',()=>openMasterGames({mode:'white'}));
$('review-master-games')?.addEventListener('click',()=>openMasterGames({}));


// v4.14.2 contextual Master Database controls
$('review-master-search-button')?.addEventListener('click',loadReviewMasterGames);
$('review-master-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')loadReviewMasterGames();});
$('master-puzzle-find')?.addEventListener('click',()=>findMasterTacticalPuzzle(masterQueryValue('master-puzzle-search')));
$('master-puzzle-random')?.addEventListener('click',()=>findMasterTacticalPuzzle(''));
$('master-puzzle-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')findMasterTacticalPuzzle(e.currentTarget.value);});

// BOZO v4.15.0 — Endgame Study + universal Scholar BOZO coach
const BOZO_TABLEBASE_ENDPOINT='https://tablebase.lichess.ovh/standard';
let endgameCatalog=[],endgameCurrent=null,endgameGame=null,endgameSelected=null,endgameMode='learn',endgameUserColor='w',endgameTarget='draw',endgameStartFen='',endgameMistakes=0,endgameHints=0,endgameBusy=false,endgameHistory=[],endgameHistoryIndex=0,endgamePremove=null,endgamePremoveSelected=null;
const endgameCoachVariantCursor=new Map();
const endgameTbCache=new Map();

function bozoCoachSetDialogue(text,{speak=true,title='Scholar BOZO'}={}){
  const targets=[$('endgame-coach-text'),$('train-scholar-text'),$('daily-scholar-text')].filter(Boolean);
  targets.forEach(el=>{el.textContent=text||'';});
  document.querySelectorAll('[data-scholar-voice-toggle]').forEach(b=>{b.textContent=reviewVoiceEnabled?'🔊 Voice on':'🔇 Voice off';b.classList.toggle('active',reviewVoiceEnabled)});
  document.querySelectorAll('[data-scholar-voice-select]').forEach(s=>s.value=reviewVoiceId);
  if(speak&&reviewVoiceEnabled&&text)bozoCoachSpeakText(text);
}
async function bozoCoachSpeakText(text){
  reviewStopVoice();
  if(!reviewVoiceEnabled||!text)return;
  const token=reviewVoiceRequestToken;
  const spoken=reviewChessTextForSpeech(String(text));
  try{
    const audio=await requestReviewCoachAudio(spoken,null);
    if(token!==reviewVoiceRequestToken)return;
    const src=audio.blob?URL.createObjectURL(audio.blob):audio.url;if(!src)return;
    reviewVoiceObjectUrl=audio.blob?src:'';reviewVoicePlayback=new Audio(src);
    reviewVoicePlayback.addEventListener('ended',()=>{if(reviewVoiceObjectUrl===src){URL.revokeObjectURL(src);reviewVoiceObjectUrl=''}},{once:true});
    await reviewVoicePlayback.play();
  }catch(error){if(token===reviewVoiceRequestToken)reviewSpeechFallback(spoken);}
}
function bindScholarControls(){
  document.querySelectorAll('[data-scholar-voice-toggle]').forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',()=>{setReviewVoiceEnabled(!reviewVoiceEnabled);bozoCoachSetDialogue('',{speak:false})})});
  document.querySelectorAll('[data-scholar-voice-select]').forEach(s=>{if(s.dataset.bound)return;s.dataset.bound='1';s.value=reviewVoiceId;s.addEventListener('change',()=>setReviewVoiceId(s.value))});
}

function endgameCoachVariant(key, variants){
  const list=(variants||[]).filter(Boolean);if(!list.length)return'';
  const next=(endgameCoachVariantCursor.get(key)||0)%list.length;endgameCoachVariantCursor.set(key,next+1);return list[next];
}
function endgameTerminalReason(game=endgameGame){
  if(!game)return'';
  if(duelCheckmate(game))return'checkmate';
  if(duelThreefold(game))return'threefold repetition';
  if(duelFiftyMoveRule(game))return'fifty-move rule';
  if(duelStalemate(game))return'stalemate';
  if(duelInsufficientMaterial(game))return'insufficient material';
  if(duelGeneralDraw(game))return'draw';
  return'';
}
function endgameTerminalUserResult(game=endgameGame){
  const reason=endgameTerminalReason(game);if(!reason)return'';
  if(reason==='checkmate')return game.turn()===endgameUserColor?'loss':'win';
  return'draw';
}
function endgameResultMeetsObjective(result){
  return (endgameTarget==='win'&&result==='win')||(endgameTarget==='draw'&&result!=='loss')||(endgameTarget==='loss'&&result==='loss');
}
function endgameTerminalLabel(reason){
  if(reason==='threefold repetition')return'Draw by repetition';
  if(reason==='fifty-move rule')return'Draw by 50-move rule';
  if(reason==='stalemate')return'Draw by stalemate';
  if(reason==='insufficient material')return'Draw by insufficient material';
  if(reason==='checkmate')return'Checkmate';
  return'Draw';
}
function endgameTerminalDialogue(result,reason,success){
  if(reason==='threefold repetition'){
    if(success&&endgameTarget==='draw')return'Draw by repetition. You completed the exercise. You used repetition correctly to hold the position.';
    if(!success&&endgameTarget==='win')return'Draw by repetition. The game is drawn, but your objective was to win.';
    return success?'Draw by repetition. That secures the result you needed.':'Draw by repetition. The position is over, but that does not meet the exercise objective.';
  }
  if(reason==='fifty-move rule'){
    if(success&&endgameTarget==='draw')return'Draw by the 50-move rule. You completed the exercise by preventing any pawn move or capture long enough to hold the draw.';
    if(!success&&endgameTarget==='win')return'Draw by the 50-move rule. The winning chance expired before you could make progress.';
  }
  if(reason==='stalemate'){
    if(success&&endgameTarget==='draw')return'Draw by stalemate. You completed the exercise by leaving the side to move with no legal move and no check.';
    if(!success&&endgameTarget==='win')return'Draw by stalemate. The win is gone because the defender has no legal move, but is not in check.';
  }
  if(reason==='insufficient material'){
    if(success&&endgameTarget==='draw')return'Draw by insufficient material. The board no longer contains enough material for checkmate, so you completed the drawing objective.';
    if(!success&&endgameTarget==='win')return'Draw by insufficient material. Too much winning material was exchanged, so checkmate is no longer possible.';
  }
  if(reason==='checkmate'){
    if(result==='win')return success?'Checkmate. You completed the exercise and finished the conversion.':'Checkmate. The game is over, but that result does not match the exercise objective.';
    return'Checkmate. The defending side finished the game, so the exercise is lost.';
  }
  if(success)return'Game over. You proved the required result. Good technique.';
  return'The game is over, but the final result does not meet the exercise objective.';
}
function endgameAtLivePosition(){return !endgameHistory.length||endgameHistoryIndex===endgameHistory.length-1;}
function endgameHistoryGame(){
  if(endgameAtLivePosition())return endgameGame;
  try{return new Chess(endgameHistory[endgameHistoryIndex]?.fen||endgameGame?.fen());}catch{return endgameGame;}
}
function endgamePushHistory(fen,san='',actor=''){
  const value=String(fen||'');if(!value)return;
  if(endgameHistory.length&&endgameHistory[endgameHistory.length-1].fen===value){endgameHistoryIndex=endgameHistory.length-1;return;}
  endgameHistory.push({fen:value,san,actor});endgameHistoryIndex=endgameHistory.length-1;
}
function endgameNavigateHistory(delta){
  if(!$('endgame-study')||$('endgame-study').hidden||!endgameHistory.length)return false;
  const next=Math.max(0,Math.min(endgameHistory.length-1,endgameHistoryIndex+delta));
  if(next===endgameHistoryIndex)return true;
  endgameHistoryIndex=next;endgameSelected=null;endgamePremoveSelected=null;paintEndgameBoard();
  const item=endgameHistory[next];
  if($('endgame-status'))$('endgame-status').textContent=`Move ${next}/${Math.max(0,endgameHistory.length-1)}${item?.san?` · ${item.san}`:''} · Use ←/→ to review, then return to the latest position to play.`;
  return true;
}
function clearEndgamePremove(){endgamePremove=null;endgamePremoveSelected=null;}
function queueEndgamePremove(from,to,promotion='q'){
  endgamePremove={from,to,promotion};endgamePremoveSelected=null;paintEndgameBoard();
  bozoCoachSetDialogue(endgameCoachVariant('premove',[`Premove queued: ${from} to ${to}. I’ll play it if the defense leaves it legal.`,`Got it. ${from} to ${to} is queued as your premove.`,`Premove set. If the reply changes the position too much, BOZO will cancel it safely.`]),{speak:false});
}
async function tryEndgamePremove(){
  if(!endgamePremove||!endgameGame||endgameGame.turn()!==endgameUserColor||endgameGame.game_over())return false;
  const queued=endgamePremove;clearEndgamePremove();
  const legal=endgameGame.moves({square:queued.from,verbose:true}).find(m=>m.to===queued.to&&(!m.promotion||m.promotion===queued.promotion));
  if(!legal){paintEndgameBoard();bozoCoachSetDialogue(endgameCoachVariant('premove-cancel',['That premove is no longer legal after the defense, so I cancelled it.','The reply changed the position, so your queued premove was safely discarded.']),{speak:false});return false;}
  await executeEndgameUserMove(legal.from,legal.to,legal.promotion||'q',true);return true;
}
async function loadEndgames(){
  const root=$('endgame-grid');if(!root)return;
  bindScholarControls();root.innerHTML='<div class="empty-state"><div>♟</div><b>Loading endgames…</b><span>Building your tablebase-backed study library.</span></div>';
  const pageSize=500;let all=[],from=0;
  while(true){
    const {data,error}=await sb.from('endgame_positions').select('*').eq('published',true).order('min_elo',{ascending:true}).order('id',{ascending:true}).range(from,from+pageSize-1);
    if(error){root.innerHTML=`<div class="empty-state"><b>Could not load Endgames</b><span>${escapeHtml(readableError(error))}</span></div>`;return;}
    const batch=data||[];all.push(...batch);
    if(batch.length<pageSize)break;
    from+=pageSize;
  }
  endgameCatalog=all;renderEndgameCatalog();
}
function endgamePieceCount(fen){return (String(fen).split(' ')[0].match(/[prnbqk]/gi)||[]).length;}
const ENDGAME_ELO_TIERS=[
  {label:'Fundamentals',min:300,max:799},
  {label:'Beginner',min:800,max:1099},
  {label:'Intermediate',min:1100,max:1399},
  {label:'Club',min:1400,max:1699},
  {label:'Advanced',min:1700,max:1999},
  {label:'Expert',min:2000,max:2299},
  {label:'Master',min:2300,max:3000}
];
function endgameTierForElo(elo){
  const n=Math.max(300,Math.min(3000,Number(elo)||300));
  return ENDGAME_ELO_TIERS.find(t=>n>=t.min&&n<=t.max)||ENDGAME_ELO_TIERS[0];
}
function endgameDifficultyLabel(row){return endgameTierForElo(row?.min_elo).label;}
function endgameEloStamp(row){
  const n=Math.max(300,Math.min(3000,Number(row?.min_elo)||300));
  return `${n}+ Elo`;
}
function endgameMaterialLabel(fen){
  try{const g=new Chess(fen),v={p:0,n:0,b:0,r:0,q:0};for(const s of ['a','b','c','d','e','f','g','h'])for(let r=1;r<=8;r++){const p=g.get(`${s}${r}`);if(p&&p.type!=='k')v[p.type]++;}return Object.entries(v).filter(x=>x[1]).map(([p,n])=>`${n}${({p:'P',n:'N',b:'B',r:'R',q:'Q'})[p]}`).join(' · ')||'Kings only';}catch{return 'Endgame';}
}
function endgamePositionFeatures(game=endgameGame){
  const out={pawns:0,rooks:0,bishops:0,knights:0,queens:0,whitePawns:0,blackPawns:0};
  try{for(const f of ['a','b','c','d','e','f','g','h'])for(let r=1;r<=8;r++){const piece=game?.get?.(`${f}${r}`);if(!piece)continue;if(piece.type==='p'){out.pawns++;piece.color==='w'?out.whitePawns++:out.blackPawns++;}else if(piece.type==='r')out.rooks++;else if(piece.type==='b')out.bishops++;else if(piece.type==='n')out.knights++;else if(piece.type==='q')out.queens++;}}catch{}
  out.pawnless=out.pawns===0;out.rookEnding=out.rooks>0;out.queenEnding=out.queens>0;out.minorEnding=(out.bishops+out.knights)>0;return out;
}
function endgamePieceName(type){return({k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'})[type]||'piece';}
function endgameDefenseDialogue(move){
  const f=endgamePositionFeatures();
  if(/[+#]$/.test(move.san))return endgameCoachVariant('defense-check',[`The defense finds ${move.san} with check. Answer the forcing move first, then reassess your plan.`,`${move.san} forces your king to respond. After that, recalculate from the new king placement instead of following the old line automatically.`]);
  if(move.captured){
    const suffix=f.pawns?'Recalculate the material balance, king activity, and any pawn race before moving again.':'With no pawn race to worry about, recalculate piece activity, king safety, and coordination before moving again.';
    return endgameCoachVariant('defense-capture',[`The defense answers with ${move.san} and changes the material. ${suffix}`,`${move.san} changes what is left on the board. ${suffix}`]);
  }
  if(move.piece==='k')return endgameCoachVariant('defense-king',[`The defender plays ${move.san}. The king has changed the key-square geometry, so check opposition, access squares, and whether your king can make progress.`,`${move.san} improves the defending king. Re-evaluate which squares your king needs and whether a direct approach still works.`]);
  if(f.pawnless&&f.rookEnding)return endgameCoachVariant('defense-pawnless-rook',[`The defender plays ${move.san}. There are no pawns here, so focus on king confinement, checking distance, and coordination between the rook and king.`,`${move.san} changes the piece geometry. In this pawnless ending, re-check checks, rook activity, and how tightly the defending king is boxed in.`]);
  if(f.pawnless&&f.minorEnding)return endgameCoachVariant('defense-pawnless-minor',[`The defender plays ${move.san}. With no pawns on the board, piece coordination and king placement are the whole position.`,`${move.san} changes the piece geometry. Recalculate checks, mating nets, and which squares the kings and minor pieces control.`]);
  if(f.pawns&&move.piece==='p')return endgameCoachVariant('defense-pawn',[`The defender plays ${move.san}. Recalculate the pawn race and which king reaches the critical squares first.`,`${move.san} changes the pawn structure. Check promotion timing, king routes, and whether a passed pawn has become more dangerous.`]);
  if(f.rookEnding)return endgameCoachVariant('defense-rook',[`The defender plays ${move.san}. Re-check active rook squares, checks from behind or the side, and whether either king can be cut off.`,`${move.san} is the defensive resource. Before continuing, compare rook activity and king position rather than counting material alone.`]);
  if(f.pawns)return endgameCoachVariant('defense-pawns',[`The defender plays ${move.san}. Recalculate key squares, king routes, and the pawn race from this exact position.`,`${move.san} changes the position. Check which pawn can advance safely and which king reaches the critical squares first.`]);
  return endgameCoachVariant('defense-generic',[`The defender plays ${move.san}. Recalculate checks, king activity, and piece coordination from the new position.`,`${move.san} is the reply. Do not continue the old plan automatically; identify what square or line the move changed.`]);
}
const ENDGAME_SEARCH_TIER_WORDS=new Set(['fundamentals','beginner','intermediate','club','advanced','expert','master']);
const ENDGAME_SEARCH_CATEGORY_ALIASES={
  pawn:['pawn','pawns','king pawn','king and pawn','pawn ending','pawn endings'],
  rook:['rook','rooks','rook ending','rook endings'],
  queen:['queen','queens','queen ending','queen endings'],
  'minor piece':['minor','minor piece','minor pieces','bishop','bishops','knight','knights','bishop ending','knight ending']
};
function normalizeEndgameSearchText(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+#=]+/g,' ').replace(/\s+/g,' ').trim();}
function endgameSearchDocument(row){
  const material=endgameMaterialLabel(row?.fen||'');
  const aliases=row?.search_aliases||'';
  const source=row?.source_type==='theory'?'theory theoretical canonical named lesson study':'master game practical example';
  return normalizeEndgameSearchText(`${row?.title||''} ${row?.category||''} ${row?.subcategory||''} ${row?.concept||''} ${row?.concept_key||''} ${aliases} ${material} ${endgameDifficultyLabel(row)} ${endgameEloStamp(row)} ${source}`);
}
function parseEndgameSearchQuery(raw){
  const q=normalizeEndgameSearchText(raw);let tier='',category='';
  for(const word of ENDGAME_SEARCH_TIER_WORDS)if(new RegExp(`(?:^| )${word}(?: |$)`).test(q)){tier=word[0].toUpperCase()+word.slice(1);break;}
  for(const [key,aliases] of Object.entries(ENDGAME_SEARCH_CATEGORY_ALIASES))if(aliases.some(a=>q.includes(normalizeEndgameSearchText(a)))){category=key==='minor piece'?'Minor Piece':key[0].toUpperCase()+key.slice(1);break;}
  const stop=new Set(['endgame','endgames','ending','endings','position','positions','study','studies','training','train','practice','lesson','lessons','theory','theoretical','type']);
  const terms=q.split(' ').filter(Boolean).filter(t=>!stop.has(t)&&!ENDGAME_SEARCH_TIER_WORDS.has(t));
  return {q,tier,category,terms};
}
function renderEndgameCatalog(){
  const root=$('endgame-grid');if(!root)return;
  const rawSearch=($('endgame-search')?.value||'').trim(),parsed=parseEndgameSearchQuery(rawSearch),cat=$('endgame-category')?.value||'all',level=$('endgame-level')?.value||'all';
  // A typed search is primary. If the user searches a named/type concept such as "Lucena",
  // stale dropdown filters from a previous browse should not hide the result. Users can still
  // type "master rook" or "advanced queen" to deliberately combine type + level.
  const activeCat=parsed.category||(!rawSearch?cat:'all');
  const activeLevel=parsed.tier||(!rawSearch?level:'all');
  const rows=endgameCatalog.filter(r=>{
    if(activeCat!=='all'&&r.category!==activeCat)return false;
    if(activeLevel!=='all'&&endgameDifficultyLabel(r)!==activeLevel)return false;
    if(!rawSearch)return true;
    const doc=endgameSearchDocument(r);
    return parsed.terms.every(term=>doc.includes(term));
  }).sort((a,b)=>(a.source_type==='theory'?0:1)-(b.source_type==='theory'?0:1)||(Number(a.min_elo)||0)-(Number(b.min_elo)||0)||(Number(a.curriculum_order)||999999)-(Number(b.curriculum_order)||999999)||String(a.title).localeCompare(String(b.title)));
  const theoryCount=endgameCatalog.filter(r=>r.source_type==='theory').length;
  const conceptCount=new Set(endgameCatalog.filter(r=>r.source_type==='theory').map(r=>r.concept_key||r.title).filter(Boolean)).size;
  $('endgame-count').textContent=`${endgameCatalog.length} studies · ${theoryCount} published theory trainings · ${conceptCount} concepts`;
  root.innerHTML=rows.map(r=>`<article class="endgame-card"><div class="endgame-card-top"><span class="endgame-category">${escapeHtml(r.category)}</span><span>${r.source_type==='theory'?`THEORY${r.variant_no?` · V${r.variant_no}`:''}`:`${endgamePieceCount(r.fen)} pieces`}</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.concept||r.subcategory||'Technical endgame')}</p><div class="endgame-meta"><span>${escapeHtml(endgameDifficultyLabel(r))}</span><span>${escapeHtml(endgameEloStamp(r))}</span><span>${escapeHtml(endgameMaterialLabel(r.fen))}</span></div><div class="endgame-card-actions"><button class="button secondary" data-endgame-open="${r.id}" data-mode="learn">Learn</button><button class="button secondary" data-endgame-open="${r.id}" data-mode="practice">Practice</button><button class="button primary" data-endgame-open="${r.id}" data-mode="test">Test</button></div></article>`).join('')||'<div class="empty-state"><b>No matches</b><span>Try a named type such as Lucena, Philidor, Vancura, opposition, Réti, queen vs rook, or rook and bishop vs rook.</span></div>';
  root.querySelectorAll('[data-endgame-open]').forEach(b=>b.addEventListener('click',()=>startEndgameStudy(b.dataset.endgameOpen,b.dataset.mode)));
}
function tbSimple(category){if(['win','syzygy-win','maybe-win'].includes(category))return'win';if(category==='cursed-win'||category==='blessed-loss'||category==='draw')return'draw';if(['loss','syzygy-loss','maybe-loss'].includes(category))return'loss';return'unknown';}
function tbInvert(v){return v==='win'?'loss':v==='loss'?'win':v;}
function tbRank(v){return v==='win'?2:v==='draw'?1:v==='loss'?0:-1;}
async function endgameTablebase(fen){
  const key=fen;if(endgameTbCache.has(key))return endgameTbCache.get(key);
  const response=await fetch(`${BOZO_TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(fen)}`);if(!response.ok)throw new Error('Tablebase unavailable for this position.');const json=await response.json();endgameTbCache.set(key,json);return json;
}
function endgameUserResult(tb){const side=endgameGame?.turn?.();const raw=tbSimple(tb.category);return side===endgameUserColor?raw:tbInvert(raw);}
function endgameConfiguredObjective(row,tb){
  const stored=String(row?.objective||'').toLowerCase();
  if(['win','draw'].includes(stored))return stored;
  const raw=tbSimple(tb?.category);
  return raw==='draw'?'draw':'win';
}
function endgameConfiguredUserColor(row,tb){
  const stored=String(row?.training_side||'').toLowerCase();
  if(stored==='w'||stored==='b')return stored;
  const turn=String(row?.fen||'').split(' ')[1]==='b'?'b':'w';
  return tbSimple(tb?.category)==='loss'?(turn==='w'?'b':'w'):turn;
}
function endgameObjectiveLabel(){return endgameTarget==='win'?'WIN':'DRAW';}
function endgameObjectiveConfigIssue(row,tb){
  if(row?.source_type!=='theory')return'';
  const live=tbSimple(tb?.category),stored=String(row?.starting_wdl||'').toLowerCase();
  if(stored&&stored!==live)return'This theory exercise was blocked because its verified starting result no longer matches the tablebase.';
  const target=endgameConfiguredObjective(row,tb),side=endgameConfiguredUserColor(row,tb),turn=String(row?.fen||'').split(' ')[1];
  const expectedSide=live==='loss'?(turn==='w'?'b':'w'):turn;
  const expectedTarget=live==='draw'?'draw':'win';
  if(side!==expectedSide||target!==expectedTarget)return'This theory exercise was blocked because its training objective needs to be re-verified.';
  return'';
}
function endgameFenHasSafeKings(fen){try{const board=String(fen||'').split(' ')[0],rows=board.split('/');if(rows.length!==8)return false;let wk=null,bk=null;for(let r=0;r<8;r++){let f=0;for(const ch of rows[r]){if(/\d/.test(ch)){f+=Number(ch);continue;}if(ch==='K')wk=[f,7-r];else if(ch==='k')bk=[f,7-r];f++;}if(f!==8)return false;}if(!wk||!bk)return false;return Math.max(Math.abs(wk[0]-bk[0]),Math.abs(wk[1]-bk[1]))>1;}catch{return false;}}
function endgameFenStructuralIssue(fen){
  const value=String(fen||'').trim();
  if(!endgameFenHasSafeKings(value))return'This endgame was blocked because its king placement is illegal.';
  if(endgamePieceCount(value)>7)return'This endgame was blocked because tablebase training supports at most seven pieces.';
  const ranks=value.split(' ')[0].split('/');
  if(/[Pp]/.test(ranks[0]||'')||/[Pp]/.test(ranks[7]||''))return'This endgame was blocked because a pawn is illegally placed on the first or eighth rank.';
  try{
    new Chess(value);
    const fields=value.split(' ');fields[1]=fields[1]==='w'?'b':'w';
    const otherTurn=new Chess(fields.join(' '));
    if(chessBoolean(otherTurn,['isCheck','inCheck','in_check']))return'This endgame was blocked because the side that is not to move is already in check.';
  }catch{return'This endgame was blocked because its FEN is invalid.';}
  return'';
}
async function startEndgameStudy(id,mode='learn'){
  const row=endgameCatalog.find(x=>String(x.id)===String(id));if(!row)return;
  endgameCurrent=row;endgameMode=mode;endgameSelected=null;endgameMistakes=0;endgameHints=0;endgameStartFen=row.fen;endgameHistory=[];endgameHistoryIndex=0;clearEndgamePremove();
  try{endgameGame=new Chess(row.fen);}catch{return toast('This endgame FEN could not be loaded.');}
  const structuralIssue=endgameFenStructuralIssue(row.fen);
  if(structuralIssue){console.error('[BOZO Endgames] blocked invalid theory position',row.id,row.fen,structuralIssue);return toast(structuralIssue);}
  let tb;
  try{tb=await endgameTablebase(endgameGame.fen());}
  catch(e){
    $('endgame-library').hidden=true;$('endgame-study').hidden=false;$('endgame-title').textContent=row.title;$('endgame-study-mode').textContent=mode.toUpperCase();
    endgameUserColor=endgameGame.turn();paintEndgameBoard();$('endgame-status').textContent='Perfect-play verification unavailable. No mistakes will be counted until it returns.';
    bozoCoachSetDialogue('I cannot verify this position against the tablebase right now, so the exercise is paused rather than guessing about your moves.',{speak:true});return;
  }
  const objectiveIssue=endgameObjectiveConfigIssue(row,tb);
  if(objectiveIssue){console.error('[BOZO Endgames] blocked objective mismatch',row.id,row.fen,row.starting_wdl,tb.category);return toast(objectiveIssue);}
  endgameUserColor=endgameConfiguredUserColor(row,tb);endgameTarget=endgameConfiguredObjective(row,tb);endgamePushHistory(endgameGame.fen());
  $('endgame-library').hidden=true;$('endgame-study').hidden=false;$('endgame-title').textContent=row.title;$('endgame-study-mode').textContent=mode.toUpperCase();
  const sourceLabel=row.source_type==='master_game'?'From the Master Games database':row.source_type==='theory'?'BOZO Theoretical Endgame':'BOZO Endgame';
  const mover=endgameGame.turn()==='w'?'WHITE':'BLACK',you=endgameUserColor==='w'?'WHITE':'BLACK';
  $('endgame-source').textContent=endgameGame.turn()===endgameUserColor?`${mover} TO MOVE · ${sourceLabel}`:`${mover} TO MOVE · YOU PLAY ${you} · ${sourceLabel}`;
  paintEndgameBoard();updateEndgameStatus(tb);
  const intro=endgameIntroDialogue(row,tb);bozoCoachSetDialogue(intro,{speak:true});
  if(endgameGame.turn()!==endgameUserColor){
    await playEndgameDefense();
    if(endgameMode==='learn'&&endgameGame&&!endgameGame.game_over()&&endgameGame.turn()===endgameUserColor){try{await showEndgameTeachingLine(await endgameTablebase(endgameGame.fen()));}catch{}}
  }else if(mode==='learn')await showEndgameTeachingLine(tb);
}

function endgameIntroDialogue(row,tb){const objective=endgameTarget==='win'?'win this position':'hold the draw';const family=String(row.category||'endgame').toLowerCase();const waits=endgameGame?.turn?.()!==endgameUserColor?` The defense moves first; you are playing ${endgameUserColor==='w'?'White':'Black'}.`:'';return endgameCoachVariant('intro-'+family,[`This is a ${family} endgame. Your task is to ${objective}.${waits} Start by checking forcing moves and king activity.`,`Your goal here is to ${objective}.${waits} Before calculating deeply, identify passed pawns, loose pieces, and the most active king.`,`Take a moment before moving. In this ${family} ending, you need to ${objective}.${waits} Checks, pawn races, and key squares are the first things I want you to scan.`]);}
function paintEndgameBoard(){
  const board=$('endgame-board');if(!board||!endgameGame)return;const orientation=endgameUserColor==='w'?'white':'black',displayGame=endgameHistoryGame();const ranks=orientation==='white'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8],files=orientation==='white'?['a','b','c','d','e','f','g','h']:['h','g','f','e','d','c','b','a'];
  board.innerHTML=ranks.flatMap(rank=>files.map(file=>{const sq=`${file}${rank}`,p=displayGame.get(sq),symbol=p?`${p.color}${p.type.toUpperCase()}`:'',selected=endgameSelected===sq||endgamePremoveSelected===sq,pmFrom=endgamePremove?.from===sq,pmTo=endgamePremove?.to===sq;return `<button type="button" data-endgame-square="${sq}" data-piece-color="${p?.color==='w'?'white':p?.color==='b'?'black':''}" class="${selected?'selected ':''}${pmFrom?'rated-premove-from ':''}${pmTo?'rated-premove-to':''}">${webPiece(symbol)}</button>`})).join('');
  syncBoardUserAnnotationPosition('endgame-board',`${displayGame.fen()}|${orientation}`);board.querySelectorAll('[data-endgame-square]').forEach(b=>b.addEventListener('click',()=>clickEndgameSquare(b.dataset.endgameSquare)));
}
async function clickEndgameSquare(square){
  if(!endgameGame||endgameGame.game_over()||!endgameAtLivePosition())return;
  const p=endgameGame.get(square),ourTurn=endgameGame.turn()===endgameUserColor;
  if(!ourTurn){
    if(!endgamePremoveSelected){if(p&&p.color===endgameUserColor){endgamePremoveSelected=square;paintEndgameBoard();}return;}
    if(p&&p.color===endgameUserColor){endgamePremoveSelected=square;paintEndgameBoard();return;}
    const from=endgamePremoveSelected;queueEndgamePremove(from,square,'q');return;
  }
  if(endgameBusy)return;
  if(!endgameSelected){if(p&&p.color===endgameUserColor){endgameSelected=square;paintEndgameBoard();}return;}
  if(p&&p.color===endgameUserColor){endgameSelected=square;paintEndgameBoard();return;}
  const from=endgameSelected;endgameSelected=null;await executeEndgameUserMove(from,square,'q',false);
}
async function executeEndgameUserMove(from,to,promotion='q',fromPremove=false){
  if(!endgameGame||endgameGame.turn()!==endgameUserColor||endgameGame.game_over())return;let move=null;try{move=endgameGame.move({from,to,promotion});}catch{}if(!move){paintEndgameBoard();return;}
  endgameBusy=true;paintEndgameBoard();
  try{
    // A real chess result outranks ordinary tablebase commentary. This catches
    // repetition, stalemate, checkmate, the 50-move rule, and insufficient
    // material immediately after the student's move.
    const terminalReason=endgameTerminalReason(endgameGame);
    if(terminalReason){
      endgamePushHistory(endgameGame.fen(),move.san,'user');
      paintEndgameBoard();
      await finishEndgame(endgameTerminalUserResult(endgameGame),terminalReason);
      endgameBusy=false;return;
    }
    const tb=await endgameTablebase(endgameGame.fen()),result=endgameUserResult(tb),preserved=tbRank(result)>=tbRank(endgameTarget);
    if(!preserved){
      // Never continue an exercise from a position where the student's verified
      // objective has already been lost. Previously Learn/Practice kept playing
      // after a bad move, so BOZO's reply could leave the board showing LOSS and
      // make a sound starting exercise look broken. Keep the feedback, rewind the
      // move, and let the student solve the original position instead.
      endgameMistakes++;
      const reason=endgameFailureDialogue(move,tb,result);
      bozoCoachSetDialogue(`${reason} Try a different move from the position before that mistake.`,{speak:true});
      endgameGame.undo();endgameSelected=null;clearEndgamePremove();paintEndgameBoard();
      try{updateEndgameStatus(await endgameTablebase(endgameGame.fen()));}catch{}
      endgameBusy=false;return;
    }
    bozoCoachSetDialogue(endgameSuccessDialogue(move,tb,result),{speak:true});
    endgamePushHistory(endgameGame.fen(),move.san,'user');updateEndgameStatus(tb);
    await playEndgameDefense();
  }catch(e){bozoCoachSetDialogue(endgameCoachVariant('verify-error',['I could not verify that move against the tablebase just now. Try it again in a moment.','The tablebase check did not return cleanly. Give that move another try.']),{speak:true});}
  endgameBusy=false;
}
function endgameFailureDialogue(move,tb,result){
  if(tb.checkmate)return endgameCoachVariant('fail-mate',[`${move.san} allows checkmate. Check the king's escape squares before committing.`,`${move.san} loses to mate. In a reduced position, one forcing check can decide everything.`]);
  if(tb.stalemate)return endgameCoachVariant('fail-stalemate',[`${move.san} allows stalemate. The opponent has no legal move, so the win disappears.`,`Careful: ${move.san} stalemates the defender. Keep at least one legal move available while you convert.`]);
  if(result==='draw'&&endgameTarget==='win')return endgameCoachVariant('fail-win-draw',[`${move.san} gives away the win. The position is now a draw, so look for the move that keeps the opponent restricted.`,`${move.san} lets the win slip. Re-check king activity, pawn races, and whether you surrendered a key checking square.`,`That move changes a winning position into a draw. Find the resource that keeps your opponent tied down instead.`]);
  if(result==='loss')return endgameCoachVariant('fail-loss',[`${move.san} turns the position into a theoretical loss. Look for the square or tempo you just gave up.`,`${move.san} loses the result. Before retrying, compare forcing checks and the race of both kings and pawns.`]);
  return endgameCoachVariant('fail-generic',[`${move.san} does not preserve the result. Compare the king positions and forcing moves before trying again.`,`Not quite. ${move.san} changes the theoretical result, so inspect checks, captures, and key squares first.`]);
}
function endgameSuccessDialogue(move,tb,result){
  const check=/[+#]$/.test(move.san);if(check)return endgameCoachVariant('success-check',[`${move.san} works because the check forces a reply and gains you a tempo for the endgame plan.`,`${move.san} keeps the result. The check matters because your opponent must answer it before creating counterplay.`,`Good. ${move.san} is forcing, so the king has to respond before the defender can improve anything else.`]);
  if(move.captured)return endgameCoachVariant('success-capture',[`${move.san} keeps the theoretical ${endgameTarget}. The exchange changes the material without giving up the result.`,`That capture works. ${move.san} simplifies while preserving the ${endgameTarget}.`,`Good conversion choice. ${move.san} changes the material, but the resulting position still meets your objective.`]);
  return endgameCoachVariant('success-quiet',[`${move.san} preserves the ${endgameTarget}. Now ask what the defender's most active reply is.`,`${move.san} is sound. Keep improving the position without allowing checks or a pawn race.`,`Good. ${move.san} holds the result. The next job is to restrict counterplay, not rush.`]);
}
async function playEndgameDefense(){
  if(!endgameGame||endgameGame.turn()===endgameUserColor||endgameGame.game_over())return;const tb=await endgameTablebase(endgameGame.fen());if(!tb.moves?.length)return;
  // The move categories in the tablebase response describe the CHILD position
  // from the next side-to-move's point of view (the student's point of view here).
  // A defender therefore wants the LOWEST child WDL rank. Among equally optimal
  // WDL moves, prefer the HIGHEST child DTZ. That makes the student's next
  // zeroing/conversion move as distant as possible instead of accidentally
  // selecting the quickest losing line (for example, hanging a queen at DTZ 1).
  let choices=tb.moves.map((m,index)=>({m,index,user:tbSimple(m.category),rank:tbRank(tbSimple(m.category)),dtz:Number.isFinite(m.dtz)?m.dtz:-Infinity}));
  choices.sort((a,b)=>a.rank-b.rank||b.dtz-a.dtz||a.index-b.index);const chosen=choices[0].m;
  const legal=endgameGame.moves({verbose:true}).find(m=>(m.from+m.to+(m.promotion||'')).toLowerCase()===chosen.uci.toLowerCase());if(legal){await new Promise(r=>setTimeout(r,420));endgameGame.move(legal);endgamePushHistory(endgameGame.fen(),legal.san,'defense');paintEndgameBoard();
    // Terminal game state always wins over the generic "defense chooses..."
    // dialogue. This is the bug that previously let the board say repetition
    // while Scholar BOZO kept talking as if the exercise were still running.
    const terminalReason=endgameTerminalReason(endgameGame);
    if(terminalReason){await finishEndgame(endgameTerminalUserResult(endgameGame),terminalReason);return;}
    const next=await endgameTablebase(endgameGame.fen());
    const nextResult=endgameUserResult(next);
    // Hard runtime invariant: after BOZO moves, the student's objective must
    // still be achievable under perfect play. If this ever fails because of bad
    // metadata/API semantics, do not strand the student in an impossible task.
    if(tbRank(nextResult)<tbRank(endgameTarget)){
      console.error('[BOZO Endgames] defense move violated training objective',endgameCurrent?.id,legal.san,endgameTarget,nextResult,endgameGame.fen());
      endgameGame.undo();
      if(endgameHistory.length>1){endgameHistory.pop();endgameHistoryIndex=endgameHistory.length-1;}
      clearEndgamePremove();paintEndgameBoard();
      try{updateEndgameStatus(await endgameTablebase(endgameGame.fen()));}catch{}
      bozoCoachSetDialogue('This exercise was paused because the defensive reply did not preserve a fair training objective. BOZO will not make you continue from an impossible position.',{speak:true});
      return;
    }
    updateEndgameStatus(next);const line=endgameDefenseDialogue(legal);bozoCoachSetDialogue(line,{speak:endgameMode!=='test'});await tryEndgamePremove();}
}
function updateEndgameStatus(tb){const result=endgameUserResult(tb);$('endgame-objective').textContent=endgameObjectiveLabel();if(endgameMode==='learn')$('endgame-status').textContent=`Theoretical result: ${result.toUpperCase()}${Number.isFinite(tb.dtz)?` · DTZ ${Math.abs(tb.dtz)}`:''}`;else if(endgameMode==='practice')$('endgame-status').textContent=`Objective ${endgameObjectiveLabel()} · theoretical result hidden during practice`;else $('endgame-status').textContent='Theoretical result hidden until the exercise ends.';$('endgame-mistakes').textContent=endgameMistakes;$('endgame-hints-used').textContent=endgameHints;}
async function showEndgameTeachingLine(tb){if(!tb?.moves?.length)return;const best=tb.moves[0];const lesson=endgameCurrent?.coach_lesson?`${endgameCurrent.coach_lesson} `:'';const text=`${lesson}A strong move to investigate is ${best.san}. Do not memorize the notation: work out what square, tempo, check, restriction, or simplification makes the move preserve your objective.`;$('endgame-learn-note').textContent=text;}
async function endgameHint(){
  if(!endgameGame||endgameBusy)return;endgameHints++;const tb=await endgameTablebase(endgameGame.fen());const ranked=(tb.moves||[]).map(m=>({m,result:tbInvert(tbSimple(m.category))})).sort((a,b)=>tbRank(b.result)-tbRank(a.result));const best=ranked[0]?.m;if(!best)return;
  const stage=Math.min(endgameHints,3),from=best.uci.slice(0,2),piece=endgameGame.get(from),features=endgamePositionFeatures();let text='';
  if(stage===1){if(features.pawnless&&features.rooks)text='There are no pawns to race. Start with forcing checks, king confinement, rook activity, and the distance between the kings.';else if(features.pawnless)text='There are no pawns here. Start with forcing moves, king placement, and how your pieces coordinate to restrict the enemy king.';else if(features.rooks)text='Start with forcing checks, active rook placement, king activity, and whether a rook belongs behind a passed pawn.';else if(features.queens)text='Start with forcing checks, king safety, and whether a queen move creates a promotion or mating threat.';else text='Start with opposition, key squares, king routes, and the exact timing of the pawn race.';}
  else if(stage===2)text=`Focus on the ${endgamePieceName(piece?.type)} on ${from}. Find the move that preserves your ${endgameObjectiveLabel().toLowerCase()} and explain what it changes before you play it.`;
  else text=`The move is ${best.san}. Before playing it, identify the concrete reason it works: a check, capture, key square, tempo, restriction, or promotion idea.`;
  bozoCoachSetDialogue(text,{speak:true});$('endgame-hints-used').textContent=endgameHints;
}
async function finishEndgame(result,reason=endgameTerminalReason(endgameGame)){
  const actual=reason?endgameTerminalUserResult(endgameGame):result;
  const won=endgameResultMeetsObjective(actual);
  const label=endgameTerminalLabel(reason);
  if($('endgame-status')){$('endgame-status').dataset.state=won?'success':'wrong';$('endgame-status').textContent=`${label} · ${won?'OBJECTIVE COMPLETE':'OBJECTIVE MISSED'}`;}
  if($('endgame-mistakes'))$('endgame-mistakes').textContent=endgameMistakes;
  if($('endgame-hints-used'))$('endgame-hints-used').textContent=endgameHints;
  clearEndgamePremove();
  bozoCoachSetDialogue(endgameTerminalDialogue(actual,reason,won),{speak:true});
  await saveEndgameProgress(won);
}
async function saveEndgameProgress(success){
  if(!state?.session?.user?.id||!endgameCurrent)return;const uid=state.session.user.id;
  try{
    const {data,error:readError}=await sb.from('endgame_progress').select('*').eq('user_id',uid).eq('endgame_id',endgameCurrent.id).maybeSingle();if(readError)throw readError;
    const patch={user_id:uid,endgame_id:endgameCurrent.id,last_practiced_at:new Date().toISOString()};if(endgameMode==='learn')patch.learn_completed=true;else if(endgameMode==='practice'){patch.practice_attempts=(data?.practice_attempts||0)+1;patch.practice_wins=(data?.practice_wins||0)+(success?1:0);}else{patch.test_attempts=(data?.test_attempts||0)+1;patch.test_wins=(data?.test_wins||0)+(success?1:0);}patch.mastery=Math.min(100,(patch.learn_completed||data?.learn_completed?25:0)+Math.min(35,(patch.practice_wins??data?.practice_wins??0)*7)+Math.min(40,(patch.test_wins??data?.test_wins??0)*10));
    const {error}=await sb.from('endgame_progress').upsert(patch,{onConflict:'user_id,endgame_id'});if(error)throw error;
  }catch(error){console.warn('[BOZO Endgames] progress save failed',error);toast('Endgame complete, but progress could not be saved.');}
}
function resetEndgame(){if(!endgameCurrent)return;startEndgameStudy(endgameCurrent.id,endgameMode);}
function closeEndgameStudy(){$('endgame-study').hidden=true;$('endgame-library').hidden=false;clearEndgamePremove();reviewStopVoice();}


document.addEventListener('keydown',event=>{
  if($('endgame-study')?.hidden!==false)return;
  const tag=event.target?.tagName?.toLowerCase();if(['input','textarea','select'].includes(tag))return;
  if(event.key==='ArrowLeft'){event.preventDefault();endgameNavigateHistory(-1);}
  else if(event.key==='ArrowRight'){event.preventDefault();endgameNavigateHistory(1);if(endgameAtLivePosition()&&endgameGame)endgameTablebase(endgameGame.fen()).then(updateEndgameStatus).catch(()=>{});}
});

// Broad coach hooks for existing training/puzzle feedback.
const _bozoSetTrainFeedback=setTrainFeedback;setTrainFeedback=function(stateName,title,copy){_bozoSetTrainFeedback(stateName,title,copy);if(['wrong','hint','answer','correct'].includes(stateName))bozoCoachSetDialogue(`${title}. ${copy}`,{speak:stateName!=='correct'||reviewVoiceEnabled});};
const _bozoSetPuzzleFeedback=setPuzzleFeedback;setPuzzleFeedback=function(stateName,title,copy){_bozoSetPuzzleFeedback(stateName,title,copy);if(['wrong','hint','answer','correct'].includes(stateName)||/not quite|correct|hint/i.test(title))bozoCoachSetDialogue(`${title}. ${copy}`,{speak:true});};

$('endgame-search')?.addEventListener('input',renderEndgameCatalog);$('endgame-category')?.addEventListener('change',renderEndgameCatalog);$('endgame-level')?.addEventListener('change',renderEndgameCatalog);$('endgame-back')?.addEventListener('click',closeEndgameStudy);$('endgame-hint')?.addEventListener('click',endgameHint);$('endgame-restart')?.addEventListener('click',resetEndgame);$('endgame-random')?.addEventListener('click',()=>{if(!endgameCatalog.length)return;const r=endgameCatalog[Math.floor(Math.random()*endgameCatalog.length)];startEndgameStudy(r.id,'test')});
$('train-mode-endgames')?.addEventListener('click',()=>{route('endgames');setTimeout(()=>{if(endgameCatalog.length){const r=endgameCatalog[Math.floor(Math.random()*endgameCatalog.length)];startEndgameStudy(r.id,'test');}},250)});

async function ownerEndgameManager(query=''){
  const target=$('owner-panel');if(!target)return;
  target.innerHTML=`<div class="panel-heading"><div><span>ENDGAME LIBRARY</span><h2>Endgame Manager</h2><p>Edit titles, categories, concepts, Elo guidance, publishing, and verification for the live endgame catalog.</p></div></div><div class="owner-elo-toolbar"><input id="owner-endgame-search" placeholder="Search title, category, concept…" value="${escapeHtml(query)}"><button id="owner-endgame-search-button" class="button primary" type="button">Search</button></div><div id="owner-endgame-results" class="owner-elo-list"></div>`;
  $('owner-endgame-search-button')?.addEventListener('click',()=>ownerLoadEndgames($('owner-endgame-search').value));$('owner-endgame-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')ownerLoadEndgames(e.currentTarget.value)});await ownerLoadEndgames(query);
}
async function ownerLoadEndgames(query=''){
  const out=$('owner-endgame-results');if(!out)return;
  out.innerHTML='<div class="empty-state"><b>Loading endgames…</b></div>';
  const q=String(query||'').trim(),pageSize=1000,rows=[];
  for(let from=0;from<5000;from+=pageSize){
    let req=sb.from('endgame_positions').select('*').order('title').range(from,from+pageSize-1);
    if(q)req=req.or(`title.ilike.%${q}%,category.ilike.%${q}%,concept.ilike.%${q}%,concept_key.ilike.%${q}%`);
    const {data,error}=await req;
    if(error){out.innerHTML=escapeHtml(readableError(error));return;}
    rows.push(...(data||[]));
    if(!data||data.length<pageSize)break;
  }
  out.innerHTML=`<div class="owner-elo-status">${rows.length} endgame${rows.length===1?'':'s'} loaded${q?` for “${escapeHtml(q)}”`:''}.</div>`+(rows.map(r=>`<article class="owner-elo-row" data-owner-endgame="${r.id}"><div class="owner-elo-opening"><div><span>${escapeHtml(r.category)} · ${escapeHtml(endgameDifficultyLabel(r))} · ${endgamePieceCount(r.fen)} pieces${r.source_type==='theory'&&r.objective?` · ${escapeHtml(String(r.objective).toUpperCase())} · YOU PLAY ${r.training_side==='b'?'BLACK':'WHITE'} · START ${escapeHtml(String(r.starting_wdl||'?').toUpperCase())}`:''}</span><h3>${escapeHtml(r.title)}</h3></div><small>${r.owner_verified?'✓ VERIFIED':'UNVERIFIED'}${r.published?' · LIVE':' · HIDDEN'}${r.source_type==='theory'&&r.pedagogy_status?` · QA ${escapeHtml(String(r.pedagogy_status).toUpperCase())}`:''}</small></div><div class="owner-elo-controls"><label>Min Elo<input data-eg-min type="number" min="300" max="3000" step="100" value="${r.min_elo}"></label><label>Max Elo<input data-eg-max type="number" min="300" max="3000" step="100" value="${r.max_elo}"></label><label class="owner-elo-reviewed"><input data-eg-verified type="checkbox" ${r.owner_verified?'checked':''}> Verified</label><label class="owner-elo-reviewed"><input data-eg-published type="checkbox" ${r.published?'checked':''}> Published</label><button class="button primary small" data-eg-save type="button">Save</button></div><label style="display:grid;gap:5px;margin-top:8px">Concept<input data-eg-concept value="${escapeHtml(r.concept||'')}"></label><div class="owner-elo-status">${escapeHtml(r.fen)}${r.pedagogy_notes?`<br><strong>QA note:</strong> ${escapeHtml(r.pedagogy_notes)}`:''}</div></article>`).join('')||'<div class="empty-state"><b>No matches.</b></div>');
  out.querySelectorAll('[data-eg-save]').forEach(b=>b.addEventListener('click',()=>ownerSaveEndgame(b.closest('[data-owner-endgame]'))));
}
async function ownerSaveEndgame(card){const id=card?.dataset.ownerEndgame;if(!id)return;const row=endgameCatalog.find(r=>r.id===id);const {error}=await sb.rpc('owner_update_endgame_position',{p_id:id,p_title:row?.title||card.querySelector('h3')?.textContent||'Endgame',p_category:row?.category||card.querySelector('.owner-elo-opening span')?.textContent?.split(' · ')[0]||'Mixed',p_concept:card.querySelector('[data-eg-concept]')?.value||'',p_min_elo:Number(card.querySelector('[data-eg-min]')?.value)||600,p_max_elo:Number(card.querySelector('[data-eg-max]')?.value)||3000,p_published:Boolean(card.querySelector('[data-eg-published]')?.checked),p_verified:Boolean(card.querySelector('[data-eg-verified]')?.checked)});if(error)return toast(readableError(error));toast('Endgame saved.');ownerLoadEndgames($('owner-endgame-search')?.value||'');}

// Keep shared Scholar BOZO controls synchronized wherever they appear.
setTimeout(bindScholarControls,0);
