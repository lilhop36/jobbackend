package com.manus.jobhunter.ethiopia.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ForestGreen = Color(0xFF1A5319)
val ForestGreenDark = Color(0xFF50B498)
val EthiopianGold = Color(0xFFF6C90E)
val Terracotta = Color(0xFFE53935)
val TealAccent = Color(0xFF80B9AD)
val SandSurface = Color(0xFFFBFBF9)
val DarkSurface = Color(0xFF161917)

private val LightScheme = lightColorScheme(
    primary = ForestGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE7F3E6),
    onPrimaryContainer = Color(0xFF072106),
    secondary = EthiopianGold,
    onSecondary = Color(0xFF3B2F00),
    tertiary = Terracotta,
    background = SandSurface,
    surface = Color.White,
    onBackground = Color(0xFF1A1C1A),
    onSurface = Color(0xFF1A1C1A),
)

private val DarkScheme = darkColorScheme(
    primary = ForestGreenDark,
    onPrimary = Color(0xFF03200B),
    primaryContainer = Color(0xFF0F3E17),
    onPrimaryContainer = Color(0xFFC7F3C7),
    secondary = EthiopianGold,
    onSecondary = Color(0xFF3B2F00),
    tertiary = Color(0xFFFFB4AB),
    background = DarkSurface,
    surface = Color(0xFF1F2420),
    onBackground = Color(0xFFE2E3E0),
    onSurface = Color(0xFFE2E3E0),
)

@Composable
fun JobHunterTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkScheme else LightScheme, content = content)
}
