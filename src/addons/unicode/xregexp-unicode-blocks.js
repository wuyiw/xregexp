/*
XRegExp addon: Unicode blocks pack 1.1
(c) 2010-2012 Steven Levithan
MIT License
<http://xregexp.com>

Uses the Unicode 6.1 character database:
<http://unicode.org/Public/6.1.0/ucd/Blocks.txt>

This package for the XRegExp Unicode addon enables the 156 Unicode 6.1 blocks
in the Basic Multilingual Plane (U+0000-U+FFFF).

Unicode blocks use the prefix "In". Example usage:

	\p{InMongolian}
	\p{InLatin Extended-A}

Letter case, spaces, hyphens, and underscores are ignored in block names.
*/

var XRegExp;

if (!(XRegExp && XRegExp.addUnicodePackage)) {
	throw ReferenceError("XRegExp's Unicode addon must be loaded before adding blocks");
}

XRegExp.addUnicodePackage({
	InBasic_Latin: "0000-007F",
	InLatin_1_Supplement: "0080-00FF",
	InLatin_Extended_A: "0100-017F",
	InLatin_Extended_B: "0180-024F",
	InIPA_Extensions: "0250-02AF",
	InSpacing_Modifier_Letters: "02B0-02FF",
	InCombining_Diacritical_Marks: "0300-036F",
	InGreek_and_Coptic: "0370-03FF",
	InCyrillic: "0400-04FF",
	InCyrillic_Supplement: "0500-052F",
	InArmenian: "0530-058F",
	InHebrew: "0590-05FF",
	InArabic: "0600-06FF",
	InSyriac: "0700-074F",
	InArabic_Supplement: "0750-077F",
	InThaana: "0780-07BF",
	InNKo: "07C0-07FF",
	InSamaritan: "0800-083F",
	InMandaic: "0840-085F",
	InArabic_Extended_A: "08A0-08FF",
	InDevanagari: "0900-097F",
	InBengali: "0980-09FF",
	InGurmukhi: "0A00-0A7F",
	InGujarati: "0A80-0AFF",
	InOriya: "0B00-0B7F",
	InTamil: "0B80-0BFF",
	InTelugu: "0C00-0C7F",
	InKannada: "0C80-0CFF",
	InMalayalam: "0D00-0D7F",
	InSinhala: "0D80-0DFF",
	InThai: "0E00-0E7F",
	InLao: "0E80-0EFF",
	InTibetan: "0F00-0FFF",
	InMyanmar: "1000-109F",
	InGeorgian: "10A0-10FF",
	InHangul_Jamo: "1100-11FF",
	InEthiopic: "1200-137F",
	InEthiopic_Supplement: "1380-139F",
	InCherokee: "13A0-13FF",
	InUnified_Canadian_Aboriginal_Syllabics: "1400-167F",
	InOgham: "1680-169F",
	InRunic: "16A0-16FF",
	InTagalog: "1700-171F",
	InHanunoo: "1720-173F",
	InBuhid: "1740-175F",
	InTagbanwa: "1760-177F",
	InKhmer: "1780-17FF",
	InMongolian: "1800-18AF",
	InUnified_Canadian_Aboriginal_Syllabics_Extended: "18B0-18FF",
	InLimbu: "1900-194F",
	InTai_Le: "1950-197F",
	InNew_Tai_Lue: "1980-19DF",
	InKhmer_Symbols: "19E0-19FF",
	InBuginese: "1A00-1A1F",
	InTai_Tham: "1A20-1AAF",
	InBalinese: "1B00-1B7F",
	InSundanese: "1B80-1BBF",
	InBatak: "1BC0-1BFF",
	InLepcha: "1C00-1C4F",
	InOl_Chiki: "1C50-1C7F",
	InSundanese_Supplement: "1CC0-1CCF",
	InVedic_Extensions: "1CD0-1CFF",
	InPhonetic_Extensions: "1D00-1D7F",
	InPhonetic_Extensions_Supplement: "1D80-1DBF",
	InCombining_Diacritical_Marks_Supplement: "1DC0-1DFF",
	InLatin_Extended_Additional: "1E00-1EFF",
	InGreek_Extended: "1F00-1FFF",
	InGeneral_Punctuation: "2000-206F",
	InSuperscripts_and_Subscripts: "2070-209F",
	InCurrency_Symbols: "20A0-20CF",
	InCombining_Diacritical_Marks_for_Symbols: "20D0-20FF",
	InLetterlike_Symbols: "2100-214F",
	InNumber_Forms: "2150-218F",
	InArrows: "2190-21FF",
	InMathematical_Operators: "2200-22FF",
	InMiscellaneous_Technical: "2300-23FF",
	InControl_Pictures: "2400-243F",
	InOptical_Character_Recognition: "2440-245F",
	InEnclosed_Alphanumerics: "2460-24FF",
	InBox_Drawing: "2500-257F",
	InBlock_Elements: "2580-259F",
	InGeometric_Shapes: "25A0-25FF",
	InMiscellaneous_Symbols: "2600-26FF",
	InDingbats: "2700-27BF",
	InMiscellaneous_Mathematical_Symbols_A: "27C0-27EF",
	InSupplemental_Arrows_A: "27F0-27FF",
	InBraille_Patterns: "2800-28FF",
	InSupplemental_Arrows_B: "2900-297F",
	InMiscellaneous_Mathematical_Symbols_B: "2980-29FF",
	InSupplemental_Mathematical_Operators: "2A00-2AFF",
	InMiscellaneous_Symbols_and_Arrows: "2B00-2BFF",
	InGlagolitic: "2C00-2C5F",
	InLatin_Extended_C: "2C60-2C7F",
	InCoptic: "2C80-2CFF",
	InGeorgian_Supplement: "2D00-2D2F",
	InTifinagh: "2D30-2D7F",
	InEthiopic_Extended: "2D80-2DDF",
	InCyrillic_Extended_A: "2DE0-2DFF",
	InSupplemental_Punctuation: "2E00-2E7F",
	InCJK_Radicals_Supplement: "2E80-2EFF",
	InKangxi_Radicals: "2F00-2FDF",
	InIdeographic_Description_Characters: "2FF0-2FFF",
	InCJK_Symbols_and_Punctuation: "3000-303F",
	InHiragana: "3040-309F",
	InKatakana: "30A0-30FF",
	InBopomofo: "3100-312F",
	InHangul_Compatibility_Jamo: "3130-318F",
	InKanbun: "3190-319F",
	InBopomofo_Extended: "31A0-31BF",
	InCJK_Strokes: "31C0-31EF",
	InKatakana_Phonetic_Extensions: "31F0-31FF",
	InEnclosed_CJK_Letters_and_Months: "3200-32FF",
	InCJK_Compatibility: "3300-33FF",
	InCJK_Unified_Ideographs_Extension_A: "3400-4DBF",
	InYijing_Hexagram_Symbols: "4DC0-4DFF",
	InCJK_Unified_Ideographs: "4E00-9FFF",
	InYi_Syllables: "A000-A48F",
	InYi_Radicals: "A490-A4CF",
	InLisu: "A4D0-A4FF",
	InVai: "A500-A63F",
	InCyrillic_Extended_B: "A640-A69F",
	InBamum: "A6A0-A6FF",
	InModifier_Tone_Letters: "A700-A71F",
	InLatin_Extended_D: "A720-A7FF",
	InSyloti_Nagri: "A800-A82F",
	InCommon_Indic_Number_Forms: "A830-A83F",
	InPhags_pa: "A840-A87F",
	InSaurashtra: "A880-A8DF",
	InDevanagari_Extended: "A8E0-A8FF",
	InKayah_Li: "A900-A92F",
	InRejang: "A930-A95F",
	InHangul_Jamo_Extended_A: "A960-A97F",
	InJavanese: "A980-A9DF",
	InCham: "AA00-AA5F",
	InMyanmar_Extended_A: "AA60-AA7F",
	InTai_Viet: "AA80-AADF",
	InMeetei_Mayek_Extensions: "AAE0-AAFF",
	InEthiopic_Extended_A: "AB00-AB2F",
	InMeetei_Mayek: "ABC0-ABFF",
	InHangul_Syllables: "AC00-D7AF",
	InHangul_Jamo_Extended_B: "D7B0-D7FF",
	InHigh_Surrogates: "D800-DB7F",
	InHigh_Private_Use_Surrogates: "DB80-DBFF",
	InLow_Surrogates: "DC00-DFFF",
	InPrivate_Use_Area: "E000-F8FF",
	InCJK_Compatibility_Ideographs: "F900-FAFF",
	InAlphabetic_Presentation_Forms: "FB00-FB4F",
	InArabic_Presentation_Forms_A: "FB50-FDFF",
	InVariation_Selectors: "FE00-FE0F",
	InVertical_Forms: "FE10-FE1F",
	InCombining_Half_Marks: "FE20-FE2F",
	InCJK_Compatibility_Forms: "FE30-FE4F",
	InSmall_Form_Variants: "FE50-FE6F",
	InArabic_Presentation_Forms_B: "FE70-FEFF",
	InHalfwidth_and_Fullwidth_Forms: "FF00-FFEF",
	InSpecials: "FFF0-FFFF"
});

