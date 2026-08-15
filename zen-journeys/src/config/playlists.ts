import type { SceneId, Track } from "../types";

/*
  ============================ PLACEHOLDER DATA ============================

  These are real song titles and artists, used purely as sample metadata so the
  player can be built and judged with realistic names, scripts and lengths.

  NO AUDIO SHIPS WITH THEM. Every `src` below is an empty string, which the
  audio engine reads as "nothing licensed here yet" and answers by synthesising
  a calm placeholder tone of its own, in code. The player is therefore fully
  playable — seek, crossfade, shuffle, repeat, auto advance — before a single
  real recording exists.

  To wire up real music, drop licensed files into `public/assets/audio/` and
  fill in the `src` fields below. Nothing else in the app has to change:

      { ..., src: "/assets/audio/suhana-safar.m4a" }

  The `duration` values are metadata hints for the pre-load state only. Once a
  file loads, the player uses the length the file itself reports.

  =========================================================================
*/

const t = (
  id: string,
  title: string,
  titleNative: string,
  artist: string,
  duration: number,
): Track => ({
  id,
  title,
  titleNative,
  artist,
  src: "", // ← real, licensed audio goes here
  duration,
});

export const PLAYLISTS: Record<SceneId, Track[]> = {
  // Weightless, floating, night sky songs.
  galaxy: [
    t("gx-1", "Khoya Khoya Chand", "खोया खोया चाँद", "Mohammed Rafi", 274),
    t("gx-2", "Chand Phir Nikla", "चाँद फिर निकला", "Lata Mangeshkar", 253),
    t("gx-3", "Yeh Raat Bheegi Bheegi", "ये रात भीगी भीगी", "Lata Mangeshkar, Manna Dey", 291),
    t("gx-4", "Tum Pukar Lo", "तुम पुकार लो", "Hemant Kumar", 246),
    t("gx-5", "Aaja Sanam Madhur Chandni", "आजा सनम मधुर चाँदनी", "Lata Mangeshkar, Manna Dey", 312),
    t("gx-6", "Aap Ki Nazron Ne Samjha", "आप की नज़रों ने समझा", "Lata Mangeshkar", 268),
    t("gx-7", "Zindagi Bhar Nahin Bhoolegi", "ज़िंदगी भर नहीं भूलेगी", "Mohammed Rafi", 259),
    t("gx-8", "Naina Barse Rim Jhim", "नैना बरसे रिम झिम", "Lata Mangeshkar", 305),
  ],

  // Long, winding, nostalgic mountain songs.
  bus: [
    t("bs-1", "Suhana Safar Aur Ye Mausam Haseen", "सुहाना सफ़र और ये मौसम हसीं", "Mukesh", 262),
    t("bs-2", "Aaja Re Pardesi", "आजा रे परदेसी", "Lata Mangeshkar", 283),
    t("bs-3", "Ae Mere Pyare Watan", "ऐ मेरे प्यारे वतन", "Manna Dey", 297),
    t("bs-4", "Yeh Raaste Hain Pyar Ke", "ये रास्ते हैं प्यार के", "Mohammed Rafi", 271),
    t("bs-5", "O Sajna Barkha Bahar Aayi", "ओ सजना बरखा बहार आई", "Lata Mangeshkar", 288),
    t("bs-6", "Meri Bheegi Bheegi Si", "मेरी भीगी भीगी सी", "Kishore Kumar", 264),
    t("bs-7", "Kuhu Kuhu Bole Koyaliya", "कुहू कुहू बोले कोयलिया", "Lata Mangeshkar, Mohammed Rafi", 341),
    t("bs-8", "Dil Tadap Tadap Ke", "दिल तड़प तड़प के", "Lata Mangeshkar, Mukesh", 279),
  ],

  // Songs written for the road: motion, freedom, no hurry.
  car: [
    t("cr-1", "Musafir Hoon Yaaron", "मुसाफ़िर हूँ यारों", "Kishore Kumar", 232),
    t("cr-2", "Zindagi Ek Safar Hai Suhana", "ज़िंदगी एक सफ़र है सुहाना", "Kishore Kumar", 248),
    t("cr-3", "Gaata Rahe Mera Dil", "गाता रहे मेरा दिल", "Kishore Kumar, Lata Mangeshkar", 305),
    t("cr-4", "Yeh Sham Mastani", "ये शाम मस्तानी", "Kishore Kumar", 226),
    t("cr-5", "Kahin Door Jab Din Dhal Jaye", "कहीं दूर जब दिन ढल जाए", "Mukesh", 264),
    t("cr-6", "Chala Jata Hoon", "चला जाता हूँ", "Kishore Kumar", 251),
    t("cr-7", "Diye Jalte Hain", "दिये जलते हैं", "Kishore Kumar", 238),
    t("cr-8", "Ruk Jana Nahin", "रुक जाना नहीं", "Kishore Kumar", 244),
  ],

  // Rhythmic, rolling, carriage-window songs.
  train: [
    t("tr-1", "Mere Sapno Ki Rani", "मेरे सपनों की रानी", "Kishore Kumar", 268),
    t("tr-2", "Chalat Musafir Moh Liya", "चलत मुसाफ़िर मोह लिया", "Manna Dey", 254),
    t("tr-3", "Sajan Re Jhoot Mat Bolo", "सजन रे झूठ मत बोलो", "Mukesh", 231),
    t("tr-4", "Panchhi Banoon Udti Phiroon", "पंछी बनूँ उड़ती फिरूँ", "Lata Mangeshkar", 219),
    t("tr-5", "Aane Wala Pal", "आने वाला पल", "Kishore Kumar", 297),
    t("tr-6", "Ek Ajnabee Haseena Se", "एक अजनबी हसीना से", "Kishore Kumar", 276),
    t("tr-7", "Duniya Banane Wale", "दुनिया बनाने वाले", "Mukesh", 289),
    t("tr-8", "Jiya O Jiya Kuchh Bol Do", "जिया ओ जिया कुछ बोल दो", "Mohammed Rafi", 242),
  ],
};

/** True while no track anywhere has a real file behind it. */
export const USING_PLACEHOLDER_AUDIO = Object.values(PLAYLISTS)
  .flat()
  .every((track) => track.src === "");
