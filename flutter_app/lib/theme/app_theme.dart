import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color bgDark = Color(0xFF090A10);
  static const Color bgCard = Color(0xFF131422);
  static const Color bgInput = Color(0xFF1A1B2E);
  static const Color borderSubtle = Color(0x1FFFFFFF);
  static const Color borderFocus = Color(0x408B5CF6);

  static const Color accentViolet = Color(0xFF8B5CF6);
  static const Color accentIndigo = Color(0xFF6366F1);
  static const Color accentEmerald = Color(0xFF10B981);
  static const Color accentRose = Color(0xFFF43F5E);
  static const Color accentAmber = Color(0xFFF59E0B);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgDark,
      primaryColor: accentViolet,
      colorScheme: const ColorScheme.dark(
        primary: accentViolet,
        secondary: accentIndigo,
        surface: bgCard,
        error: accentRose,
      ),
      textTheme: GoogleFonts.outfitTextTheme(
        ThemeData.dark().textTheme,
      ).apply(
        bodyColor: Colors.white,
        displayColor: Colors.white,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bgDark.withOpacity(0.9),
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      cardTheme: CardTheme(
        color: bgCard,
        elevation: 6,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: borderSubtle),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgInput,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: const BorderSide(color: borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: const BorderSide(color: accentViolet, width: 1.5),
        ),
        hintStyle: const TextStyle(color: Colors.white38, fontSize: 14),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      ),
    );
  }
}
