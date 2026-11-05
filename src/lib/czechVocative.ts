/**
 * Skloňuje křestní jméno do 5. pádu (vokativ) pro oslovení v SMS,
 * např. "Karolína" → "Karolíno". Funguje jen přes pevný seznam
 * nejběžnějších českých jmen – u neznámého/nejistého jména vrátí
 * beze změny celé zadané jméno (nikdy nehádá).
 */

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const VOCATIVE: Record<string, string> = {
  // ženská jména
  adela: "Adélo", alena: "Aleno", alzbeta: "Alžběto", anna: "Anno", barbora: "Barboro",
  dana: "Dano", daniela: "Danielo", denisa: "Deniso", eliska: "Eliško", eva: "Evo",
  hana: "Hano", helena: "Heleno", irena: "Ireno", iveta: "Iveto", ivana: "Ivano",
  jana: "Jano", jarmila: "Jarmilo", jitka: "Jitko", jolana: "Jolano", kamila: "Kamilo",
  karolina: "Karolíno", katerina: "Kateřino", kristyna: "Kristýno", lenka: "Lenko",
  lucie: "Lucie", marie: "Marie", marketa: "Markéto", martina: "Martino",
  michaela: "Michaelo", milena: "Mileno", miroslava: "Miroslavo", monika: "Moniko",
  natalie: "Natálie", nikola: "Nikolo", olga: "Olgo", pavla: "Pavlo", petra: "Petro",
  radka: "Radko", renata: "Renato", romana: "Romano", simona: "Simono", sona: "Soňo",
  stepanka: "Štěpánko", tereza: "Terezo", veronika: "Veroniko", vladimira: "Vladimíro",
  zdenka: "Zdeňko", zuzana: "Zuzano",
  // mužská jména
  adam: "Adame", ales: "Aleši", antonin: "Antoníne", david: "Davide", dominik: "Dominiku",
  filip: "Filipe", frantisek: "Františku", jakub: "Jakube", jan: "Jane",
  jaroslav: "Jaroslave", jiri: "Jiří", josef: "Josefe", karel: "Karle", lukas: "Lukáši",
  marek: "Marku", martin: "Martine", matej: "Matěji", michal: "Michale", milan: "Milane",
  miroslav: "Miroslave", ondrej: "Ondřeji", pavel: "Pavle", petr: "Petře", radek: "Radku",
  roman: "Romane", stanislav: "Stanislave", tomas: "Tomáši", vaclav: "Václave",
  vojtech: "Vojtěchu", zdenek: "Zdeňku",
};

/**
 * @param fullName Celé jméno zadané makléřem (např. "Karolina Krutova").
 * @returns Oslovení v 5. pádu, jen křestní jméno (např. "Karolíno"),
 *   nebo beze změny celé `fullName`, pokud jméno není v seznamu.
 */
export function toVocative(fullName: string): string {
  const firstName = (fullName || "").trim().split(/\s+/)[0] ?? "";
  if (!firstName) return fullName;
  const key = stripDiacritics(firstName).toLowerCase();
  return VOCATIVE[key] ?? fullName;
}
