package com.manus.jobhunter.ethiopia.data.repository

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "jobhunter_prefs")

class PreferencesRepository(ctx: Context) {
    private val ds = ctx.dataStore

    companion object {
        val LANGUAGE = stringPreferencesKey("language")
        val REGIONS = stringPreferencesKey("regions")
        val CONSENT_AI = booleanPreferencesKey("consent_ai")
        val AI_PROVIDER = stringPreferencesKey("ai_provider")
        val ONBOARDING_DONE = booleanPreferencesKey("onboarding_done")
    }

    val language: Flow<String> = ds.data.map { it[LANGUAGE] ?: "en" }
    val regions: Flow<String> = ds.data.map { it[REGIONS] ?: "Addis Ababa" }
    val consentAi: Flow<Boolean> = ds.data.map { it[CONSENT_AI] ?: false }
    val aiProvider: Flow<String> = ds.data.map { it[AI_PROVIDER] ?: "groq" }
    val onboardingDone: Flow<Boolean> = ds.data.map { it[ONBOARDING_DONE] ?: false }

    suspend fun setLanguage(v: String) { ds.edit { it[LANGUAGE] = v } }
    suspend fun setRegions(v: String) { ds.edit { it[REGIONS] = v } }
    suspend fun setConsentAi(v: Boolean) { ds.edit { it[CONSENT_AI] = v } }
    suspend fun setAiProvider(v: String) { ds.edit { it[AI_PROVIDER] = v } }
    suspend fun setOnboardingDone(v: Boolean) { ds.edit { it[ONBOARDING_DONE] = v } }
}
