/** Major international seaports for UN/LOCODE autocomplete (reference data only). */
export type InternationalPort = {
  unlocode: string;
  nameEn: string;
  nameAr: string;
  country: string;
  countryCode: string;
};

export const INTERNATIONAL_PORTS: InternationalPort[] = [
  { unlocode: 'OMSOH', nameEn: 'Port of Sohar', nameAr: 'ميناء صحار', country: 'Oman', countryCode: 'OM' },
  { unlocode: 'OMMCT', nameEn: 'Port of Muscat (Sultan Qaboos)', nameAr: 'ميناء مسقط', country: 'Oman', countryCode: 'OM' },
  { unlocode: 'OMSLL', nameEn: 'Port of Salalah', nameAr: 'ميناء صلالة', country: 'Oman', countryCode: 'OM' },
  { unlocode: 'AEJEA', nameEn: 'Jebel Ali', nameAr: 'جبل علي', country: 'UAE', countryCode: 'AE' },
  { unlocode: 'AEDXB', nameEn: 'Port Rashid / Dubai', nameAr: 'دبي', country: 'UAE', countryCode: 'AE' },
  { unlocode: 'AEAUH', nameEn: 'Abu Dhabi (Khalifa)', nameAr: 'أبوظبي', country: 'UAE', countryCode: 'AE' },
  { unlocode: 'SAJED', nameEn: 'Jeddah Islamic Port', nameAr: 'جدة', country: 'Saudi Arabia', countryCode: 'SA' },
  { unlocode: 'SADMM', nameEn: 'Dammam (King Abdul Aziz)', nameAr: 'الدمام', country: 'Saudi Arabia', countryCode: 'SA' },
  { unlocode: 'KWKWI', nameEn: 'Shuwaikh Port', nameAr: 'الشويخ', country: 'Kuwait', countryCode: 'KW' },
  { unlocode: 'QAHMD', nameEn: 'Hamad Port', nameAr: 'ميناء حمد', country: 'Qatar', countryCode: 'QA' },
  { unlocode: 'BHKBS', nameEn: 'Khalifa Bin Salman', nameAr: 'خليفة بن سلمان', country: 'Bahrain', countryCode: 'BH' },
  { unlocode: 'INMUN', nameEn: 'Mundra', nameAr: 'موندرا', country: 'India', countryCode: 'IN' },
  { unlocode: 'INNSA', nameEn: 'Nhava Sheva (JNPT)', nameAr: 'نهافا شيفا', country: 'India', countryCode: 'IN' },
  { unlocode: 'PKKHI', nameEn: 'Karachi', nameAr: 'كرachi', country: 'Pakistan', countryCode: 'PK' },
  { unlocode: 'SGSIN', nameEn: 'Singapore', nameAr: 'سنغافورة', country: 'Singapore', countryCode: 'SG' },
  { unlocode: 'CNSHA', nameEn: 'Shanghai', nameAr: 'شنغهاي', country: 'China', countryCode: 'CN' },
  { unlocode: 'CNQIN', nameEn: 'Qingdao', nameAr: 'تشينغداو', country: 'China', countryCode: 'CN' },
  { unlocode: 'CNYTN', nameEn: 'Yantian', nameAr: 'يانتian', country: 'China', countryCode: 'CN' },
  { unlocode: 'HKHKG', nameEn: 'Hong Kong', nameAr: 'هونغ كونغ', country: 'Hong Kong', countryCode: 'HK' },
  { unlocode: 'KRPUS', nameEn: 'Busan', nameAr: 'بusan', country: 'South Korea', countryCode: 'KR' },
  { unlocode: 'JPYOK', nameEn: 'Yokohama', nameAr: 'يوكوهاما', country: 'Japan', countryCode: 'JP' },
  { unlocode: 'NLRTM', nameEn: 'Rotterdam', nameAr: 'روتterdam', country: 'Netherlands', countryCode: 'NL' },
  { unlocode: 'DEHAM', nameEn: 'Hamburg', nameAr: 'هamburg', country: 'Germany', countryCode: 'DE' },
  { unlocode: 'BEANR', nameEn: 'Antwerp', nameAr: 'أntwerp', country: 'Belgium', countryCode: 'BE' },
  { unlocode: 'GBFXT', nameEn: 'Felixstowe', nameAr: 'فelixstowe', country: 'United Kingdom', countryCode: 'GB' },
  { unlocode: 'USNYC', nameEn: 'New York / New Jersey', nameAr: 'نيويork', country: 'USA', countryCode: 'US' },
  { unlocode: 'USLAX', nameEn: 'Los Angeles', nameAr: 'لos angeles', country: 'USA', countryCode: 'US' },
  { unlocode: 'EGPSD', nameEn: 'Port Said', nameAr: 'بort said', country: 'Egypt', countryCode: 'EG' },
  { unlocode: 'EGALY', nameEn: 'Alexandria', nameAr: 'الإسكندرية', country: 'Egypt', countryCode: 'EG' },
];
