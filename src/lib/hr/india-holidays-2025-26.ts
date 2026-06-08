export type HolidayType = 'gazetted' | 'restricted' | 'festival' | 'regional'
export type Religion =
  | 'National' | 'Hindu' | 'Muslim' | 'Christian' | 'Sikh'
  | 'Buddhist' | 'Jain' | 'Parsi' | 'Regional'

export interface IndiaHoliday {
  name: string
  date: string            // YYYY-MM-DD
  type: HolidayType
  religion: Religion
  state?: string          // if regional, which state(s)
  note?: string           // extra context
}

// Day-of-week helper (pure, no date-fns needed)
export function getDayName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const d = new Date(dateStr + 'T00:00:00Z')
  return days[d.getUTCDay()]
}

export function isSunday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay() === 0
}

export function isSaturday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay() === 6
}

// ─── COMPREHENSIVE FY 2025–26 HOLIDAY LIST ───────────────────────────────────
// Covers: Jan 2025 – Mar 2026 (full FY + context months)
// Islamic dates marked [approx] — subject to moon-sighting confirmation
// Lunar Hindu dates calculated from standard Drik Panchang 2025
// ──────────────────────────────────────────────────────────────────────────────

export const INDIA_HOLIDAYS_2025_26: IndiaHoliday[] = [

  // ── JANUARY 2025 ────────────────────────────────────────────────────────────

  { name: 'New Year\'s Day', date: '2025-01-01', type: 'festival', religion: 'Regional', note: 'Optional / Regional' },
  { name: 'Epiphany (Three Kings Day)', date: '2025-01-06', type: 'restricted', religion: 'Christian', note: 'Observed in Goa, Kerala' },
  { name: 'Guru Gobind Singh Jayanti', date: '2025-01-06', type: 'restricted', religion: 'Sikh', note: '358th birth anniversary' },
  { name: 'Lohri', date: '2025-01-13', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Harvest festival marking end of winter' },
  { name: 'Makar Sankranti', date: '2025-01-14', type: 'restricted', religion: 'Hindu', note: 'Solar new year; sun enters Capricorn' },
  { name: 'Pongal (Thai Pongal)', date: '2025-01-14', type: 'regional', religion: 'Hindu', state: 'Tamil Nadu', note: '4-day harvest festival; 2nd day is main Pongal' },
  { name: 'Bhogali Bihu (Magh Bihu)', date: '2025-01-15', type: 'regional', religion: 'Regional', state: 'Assam', note: 'Harvest festival marking end of harvesting season' },
  { name: 'Republic Day', date: '2025-01-26', type: 'gazetted', religion: 'National', note: '76th Republic Day — Constitution came into force 1950' },

  // ── FEBRUARY 2025 ───────────────────────────────────────────────────────────

  { name: 'Vasant Panchami (Saraswati Puja)', date: '2025-02-02', type: 'restricted', religion: 'Hindu', note: '5th day of Magha Shukla Paksha; goddess of learning' },
  { name: 'Ash Wednesday', date: '2025-03-05', type: 'restricted', religion: 'Christian', note: 'Marks beginning of Lent; 40 days before Easter' },
  { name: 'Shab-e-Barat', date: '2025-02-14', type: 'restricted', religion: 'Muslim', note: '15th night of Sha\'ban; Night of Forgiveness [approx]' },
  { name: 'Losar (Tibetan New Year)', date: '2025-02-28', type: 'regional', religion: 'Buddhist', state: 'Ladakh, Sikkim, Arunachal Pradesh', note: 'Tibetan-Buddhist lunar new year [approx]' },
  { name: 'Maha Shivratri', date: '2025-02-26', type: 'restricted', religion: 'Hindu', note: '14th night of Krishna Paksha in Phalguna; fast for Lord Shiva' },

  // ── MARCH 2025 ──────────────────────────────────────────────────────────────

  { name: 'Chapchar Kut', date: '2025-03-07', type: 'regional', religion: 'Regional', state: 'Mizoram', note: 'Spring festival; celebrated on first Friday of March after jungle clearing' },
  { name: 'Holika Dahan', date: '2025-03-13', type: 'festival', religion: 'Hindu', note: 'Purnima of Phalguna; burning of evil (Holika); eve of Holi' },
  { name: 'Hola Mohalla', date: '2025-03-15', type: 'regional', religion: 'Sikh', state: 'Punjab (Anandpur Sahib)', note: 'Sikh martial arts and community fair; day after Holi' },
  { name: 'Holi', date: '2025-03-14', type: 'gazetted', religion: 'Hindu', note: 'Festival of colours; 2nd day of Phalguna Purnima' },
  { name: 'Shab-e-Qadr', date: '2025-03-27', type: 'restricted', religion: 'Muslim', note: '27th night of Ramadan; Night of Power [approx]' },
  { name: 'Ugadi (Yugadi)', date: '2025-03-30', type: 'regional', religion: 'Hindu', state: 'Andhra Pradesh, Telangana, Karnataka', note: 'Telugu & Kannada New Year; Chaitra Shukla Pratipada' },
  { name: 'Gudi Padwa', date: '2025-03-30', type: 'regional', religion: 'Hindu', state: 'Maharashtra', note: 'Marathi New Year; Chaitra Shukla Pratipada' },
  { name: 'Id-ul-Fitr (Eid)', date: '2025-03-31', type: 'gazetted', religion: 'Muslim', note: 'End of Ramadan; festival of breaking fast [approx — moon sighting]' },

  // ── APRIL 2025 ──────────────────────────────────────────────────────────────

  { name: 'Ram Navami', date: '2025-04-06', type: 'restricted', religion: 'Hindu', note: 'Chaitra Shukla Navami; birth of Lord Rama' },
  { name: 'Mahavir Jayanti', date: '2025-04-10', type: 'gazetted', religion: 'Jain', note: 'Chaitra Shukla Trayodashi; 2623rd birth anniversary of Tirthankara Mahavira' },
  { name: 'Hanuman Jayanti', date: '2025-04-12', type: 'restricted', religion: 'Hindu', note: 'Chaitra Purnima; birth of Lord Hanuman' },
  { name: 'Baisakhi (Vaisakhi)', date: '2025-04-13', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Sikh New Year; founding of Khalsa Panth 1699; harvest festival' },
  { name: 'Puthandu (Tamil New Year)', date: '2025-04-14', type: 'regional', religion: 'Hindu', state: 'Tamil Nadu', note: 'First day of Chithirai; Tamil solar new year' },
  { name: 'Vishu', date: '2025-04-14', type: 'regional', religion: 'Hindu', state: 'Kerala', note: 'Malayalam New Year; first day of Medam; Vishukkani ritual' },
  { name: 'Dr. Ambedkar Jayanti', date: '2025-04-14', type: 'restricted', religion: 'Buddhist', note: '134th birth anniversary of Dr. B. R. Ambedkar; observed nationally' },
  { name: 'Rongali Bihu (Bohag Bihu)', date: '2025-04-14', type: 'regional', religion: 'Regional', state: 'Assam', note: 'Assamese New Year; spring festival; 7-day celebration begins' },
  { name: 'Poila Boishakh', date: '2025-04-15', type: 'regional', religion: 'Regional', state: 'West Bengal', note: 'Bengali New Year; Naba Barsha; first day of Baisakh month' },
  { name: 'Good Friday', date: '2025-04-18', type: 'gazetted', religion: 'Christian', note: 'Crucifixion of Jesus Christ; 2 days before Easter' },
  { name: 'Easter Sunday', date: '2025-04-20', type: 'restricted', religion: 'Christian', note: 'Resurrection of Jesus Christ; first Sunday after spring full moon' },
  { name: 'Gangaur', date: '2025-04-01', type: 'regional', religion: 'Hindu', state: 'Rajasthan', note: 'Chaitra Shukla Tritiya; 18 days after Holi; Gauri (Parvati) worship' },
  { name: 'Akshaya Tritiya', date: '2025-04-30', type: 'festival', religion: 'Hindu', note: 'Vaishakha Shukla Tritiya; auspicious day; gold purchase tradition' },

  // ── MAY 2025 ────────────────────────────────────────────────────────────────

  { name: 'Thrissur Pooram', date: '2025-05-05', type: 'regional', religion: 'Hindu', state: 'Kerala (Thrissur)', note: 'Grand elephant procession; May date approximate — Malayalam calendar' },
  { name: 'Buddha Purnima (Vesak)', date: '2025-05-12', type: 'gazetted', religion: 'Buddhist', note: 'Vaishakha Purnima; birth, enlightenment & Parinirvana of Gautama Buddha' },

  // ── JUNE 2025 ───────────────────────────────────────────────────────────────

  { name: 'Id-ul-Zuha (Bakrid / Eid-ul-Adha)', date: '2025-06-07', type: 'gazetted', religion: 'Muslim', note: 'Feast of sacrifice; Ibrahim\'s devotion; Hajj culmination [approx]' },
  { name: 'Rath Yatra', date: '2025-06-27', type: 'regional', religion: 'Hindu', state: 'Odisha (Puri; national significance)', note: 'Ashadha Shukla Dwitiya; chariot procession of Lord Jagannath' },

  // ── JULY 2025 ───────────────────────────────────────────────────────────────

  { name: 'Muharram (Ashura)', date: '2025-07-06', type: 'gazetted', religion: 'Muslim', note: 'Islamic New Year; 10th Muharram marks martyrdom of Imam Hussain [approx]' },
  { name: 'Asalha Puja (Dharma Day)', date: '2025-07-10', type: 'festival', religion: 'Buddhist', note: 'Ashadha Purnima; Buddha\'s first sermon at Sarnath; observed in some regions' },
  { name: 'Guru Purnima', date: '2025-07-10', type: 'festival', religion: 'Hindu', note: 'Ashadha Purnima; reverence for spiritual and academic teachers' },
  { name: 'Teej (Hariyali Teej)', date: '2025-08-02', type: 'regional', religion: 'Hindu', state: 'Rajasthan, UP, Bihar', note: 'Shravan Shukla Tritiya; women\'s festival; Parvati-Shiva reunion' },

  // ── AUGUST 2025 ─────────────────────────────────────────────────────────────

  { name: 'Raksha Bandhan', date: '2025-08-09', type: 'restricted', religion: 'Hindu', note: 'Shravan Purnima; brother-sister bond; tying of sacred thread' },
  { name: 'Independence Day', date: '2025-08-15', type: 'gazetted', religion: 'National', note: '79th Independence Day; end of British rule 1947' },
  { name: 'Pateti', date: '2025-08-15', type: 'restricted', religion: 'Parsi', note: 'Last day of Zoroastrian Shahenshahi year; day of introspection [coincides with Independence Day]' },
  { name: 'Janmashtami', date: '2025-08-16', type: 'gazetted', religion: 'Hindu', note: 'Bhadrapada Krishna Ashtami; birth of Lord Krishna; midnight celebration' },
  { name: 'Parsi New Year (Navroz)', date: '2025-08-16', type: 'restricted', religion: 'Parsi', note: 'Shahenshahi calendar; Zoroastrian new year; celebrated in Maharashtra & Gujarat' },
  { name: 'Onam (Thiruvonam)', date: '2025-08-27', type: 'regional', religion: 'Hindu', state: 'Kerala', note: 'Thiruvonam nakshatra in Chingam; 10-day harvest festival; return of King Mahabali [approx]' },
  { name: 'Ganesh Chaturthi (Vinayaka Chaturthi)', date: '2025-08-27', type: 'restricted', religion: 'Hindu', note: 'Bhadrapada Shukla Chaturthi; 10-day festival; major in Maharashtra, Karnataka, AP, Telangana' },

  // ── SEPTEMBER 2025 ──────────────────────────────────────────────────────────

  { name: 'Paryushana (Jain Shwetambar)', date: '2025-08-28', type: 'festival', religion: 'Jain', note: '8-day period of fasting & reflection; date approx per Shwetambar panchang' },
  { name: 'Samvatsari (Jain)', date: '2025-09-04', type: 'restricted', religion: 'Jain', note: 'Last & holiest day of Paryushana; universal forgiveness — Micchami Dukkadam' },
  { name: 'Das Lakshana (Jain Digambara)', date: '2025-09-02', type: 'festival', religion: 'Jain', note: '10-day Digambara equivalent of Paryushana [approx]' },
  { name: 'Milad-un-Nabi (Eid-e-Milad)', date: '2025-09-05', type: 'gazetted', religion: 'Muslim', note: '12th Rabi-ul-Awwal; birth anniversary of Prophet Muhammad [approx]' },
  { name: 'Navratri (Sharad) — Begins', date: '2025-09-23', type: 'festival', religion: 'Hindu', note: 'Ashwin Shukla Pratipada; 9 nights of Durga worship; Garba & Dandiya' },

  // ── OCTOBER 2025 ────────────────────────────────────────────────────────────

  { name: 'Durga Puja — Maha Ashtami', date: '2025-09-30', type: 'regional', religion: 'Hindu', state: 'West Bengal (national importance)', note: 'Ashwin Shukla Ashtami; most important day of Durga Puja; sandhi puja' },
  { name: 'Durga Puja — Maha Navami', date: '2025-10-01', type: 'regional', religion: 'Hindu', state: 'West Bengal (national importance)', note: 'Ashwin Shukla Navami; Durga idol worship concludes' },
  { name: 'Gandhi Jayanti', date: '2025-10-02', type: 'gazetted', religion: 'National', note: '156th birth anniversary of Mahatma Gandhi; International Day of Non-Violence (UN)' },
  { name: 'Dussehra (Vijaya Dashami)', date: '2025-10-02', type: 'gazetted', religion: 'Hindu', note: 'Ashwin Shukla Dashami; victory of Rama over Ravana; Ravan dahan [coincides with Gandhi Jayanti 2025]' },
  { name: 'Karwa Chauth', date: '2025-10-09', type: 'regional', religion: 'Hindu', state: 'North India (Punjab, Haryana, UP, Rajasthan, Delhi)', note: 'Kartik Krishna Chaturthi; wives fast for husbands\' longevity; moonrise ritual' },
  { name: 'Dhanteras (Dhanatrayodashi)', date: '2025-10-18', type: 'festival', religion: 'Hindu', note: 'Kartik Krishna Trayodashi; first day of Diwali festival; purchase of gold/silver/utensils' },
  { name: 'Naraka Chaturdashi (Chhoti Diwali)', date: '2025-10-19', type: 'festival', religion: 'Hindu', note: 'Kartik Krishna Chaturdashi; Naraka Asura slain by Krishna; early morning oil bath' },
  { name: 'Diwali (Deepavali)', date: '2025-10-20', type: 'gazetted', religion: 'Hindu', note: 'Kartik Amavasya; festival of lights; Lakshmi Puja; firecrackers' },
  { name: 'Diwali — Jain (Mahavira Nirvana)', date: '2025-10-20', type: 'festival', religion: 'Jain', note: 'Kartik Amavasya; Lord Mahavira attained Nirvana on this day in 527 BCE' },
  { name: 'Govardhan Puja (Annakut)', date: '2025-10-21', type: 'festival', religion: 'Hindu', note: 'Kartik Shukla Pratipada; Krishna lifted Govardhan Hill; food offering to deity' },
  { name: 'Bhai Dooj (Bhau-Beej)', date: '2025-10-22', type: 'festival', religion: 'Hindu', note: 'Kartik Shukla Dwitiya; brother-sister celebration; Yama-Yamuna legend' },
  { name: 'Chhath Puja', date: '2025-10-26', type: 'regional', religion: 'Hindu', state: 'Bihar, Uttar Pradesh, Jharkhand, Delhi NCR', note: 'Kartik Shukla Shashthi; worship of Sun god; sunset & sunrise offerings from riverbanks [2025 falls on Sunday]' },
  { name: 'Dev Uthani Ekadashi (Devutthana)', date: '2025-10-31', type: 'festival', religion: 'Hindu', note: 'Kartik Shukla Ekadashi; Lord Vishnu wakes from 4-month sleep (Chaturmas ends); marriage season begins' },
  { name: 'Khordad Sal (Zoroaster\'s Birthday)', date: '2025-10-31', type: 'restricted', religion: 'Parsi', note: '6th day of Khordad month; birth anniversary of Prophet Zoroaster [Shahenshahi approx]' },
  { name: 'Wangala (100 Drums Festival)', date: '2025-11-01', type: 'regional', religion: 'Regional', state: 'Meghalaya', note: 'Garo harvest festival; thanksgiving to sun god Saljong; November date approx' },

  // ── NOVEMBER 2025 ───────────────────────────────────────────────────────────

  { name: 'Guru Nanak Jayanti (Gurpurab)', date: '2025-11-05', type: 'gazetted', religion: 'Sikh', note: 'Kartik Purnima; 556th birth anniversary of Guru Nanak Dev Ji; Nagar Kirtan processions' },
  { name: 'Kartik Purnima', date: '2025-11-05', type: 'festival', religion: 'Hindu', note: 'Kartik Purnima; Dev Diwali; holy dip in Ganges; Pushkar Fair (Rajasthan)' },
  { name: 'Loy Krathong', date: '2025-11-05', type: 'festival', religion: 'Buddhist', note: 'Full moon of Kartik; floating lamp festival; observed in communities in some eastern states' },
  { name: 'Hornbill Festival — Opens', date: '2025-12-01', type: 'regional', religion: 'Regional', state: 'Nagaland (Kohima)', note: '10-day festival (Dec 1–10); tribal heritage celebration; all 16 Naga tribes participate' },
  { name: 'Gurpurab — Guru Tegh Bahadur Shaheedi', date: '2025-11-24', type: 'restricted', religion: 'Sikh', note: 'Martyrdom day of 9th Sikh Guru; Nov date approximate (Maghar Shukla Panchami)' },

  // ── DECEMBER 2025 ───────────────────────────────────────────────────────────

  { name: 'Christmas', date: '2025-12-25', type: 'gazetted', religion: 'Christian', note: 'Birth of Jesus Christ' },
  { name: 'Christmas Eve', date: '2025-12-24', type: 'festival', religion: 'Christian', note: 'Midnight Mass; major celebration in Goa, Kerala, North-East India' },

  // ── JANUARY 2026 ────────────────────────────────────────────────────────────

  { name: 'New Year\'s Day 2026', date: '2026-01-01', type: 'festival', religion: 'Regional', note: 'Optional / Regional' },
  { name: 'Guru Gobind Singh Jayanti 2026', date: '2026-01-06', type: 'restricted', religion: 'Sikh', note: '359th birth anniversary; date per Nanakshahi calendar [approx]' },
  { name: 'Lohri 2026', date: '2026-01-13', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Jan 13 fixed annually' },
  { name: 'Makar Sankranti 2026', date: '2026-01-14', type: 'restricted', religion: 'Hindu', note: 'Jan 14 fixed annually; sun enters Makar (Capricorn)' },
  { name: 'Pongal 2026', date: '2026-01-14', type: 'regional', religion: 'Hindu', state: 'Tamil Nadu', note: '4-day harvest festival; Jan 14 fixed' },
  { name: 'Bhogali Bihu 2026', date: '2026-01-15', type: 'regional', religion: 'Regional', state: 'Assam', note: 'Jan 15 fixed annually' },
  { name: 'Republic Day 2026', date: '2026-01-26', type: 'gazetted', religion: 'National', note: '77th Republic Day' },

  // ── FEBRUARY 2026 ───────────────────────────────────────────────────────────

  { name: 'Vasant Panchami 2026', date: '2026-01-22', type: 'restricted', religion: 'Hindu', note: 'Magha Shukla Panchami 2026 [approx]' },
  { name: 'Maha Shivratri 2026', date: '2026-02-15', type: 'restricted', religion: 'Hindu', note: 'Phalguna Krishna Chaturdashi 2026 [approx — falls on Sunday]' },
  { name: 'Shab-e-Barat 2026', date: '2026-02-03', type: 'restricted', religion: 'Muslim', note: '15th Sha\'ban 1447 AH [approx]' },

  // ── MARCH 2026 ──────────────────────────────────────────────────────────────

  { name: 'Holika Dahan 2026', date: '2026-03-02', type: 'festival', religion: 'Hindu', note: 'Eve of Holi 2026 [approx]' },
  { name: 'Holi 2026', date: '2026-03-03', type: 'gazetted', religion: 'Hindu', note: 'Phalguna Purnima 2026 [approx]' },
  { name: 'Ash Wednesday 2026', date: '2026-02-18', type: 'restricted', religion: 'Christian', note: '46 days before Good Friday 2026 [approx]' },
  { name: 'Id-ul-Fitr 2026 (Eid)', date: '2026-03-20', type: 'gazetted', religion: 'Muslim', note: 'End of Ramadan 1447 AH [approx — moon sighting]' },
  { name: 'Ugadi 2026', date: '2026-03-19', type: 'regional', religion: 'Hindu', state: 'Andhra Pradesh, Telangana, Karnataka', note: 'Telugu-Kannada New Year 2026 [approx]' },
  { name: 'Gudi Padwa 2026', date: '2026-03-19', type: 'regional', religion: 'Hindu', state: 'Maharashtra', note: 'Marathi New Year 2026 [approx]' },
]
