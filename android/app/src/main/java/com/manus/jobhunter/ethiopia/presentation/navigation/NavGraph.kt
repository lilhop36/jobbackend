package com.manus.jobhunter.ethiopia.presentation.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val titleRes: Int, val icon: ImageVector? = null) {
    object Home : Screen("home", com.manus.jobhunter.ethiopia.R.string.nav_home, Icons.Default.Home)
    object Discover : Screen("discover", com.manus.jobhunter.ethiopia.R.string.nav_discover, Icons.Default.Work)
    object Saved : Screen("saved", com.manus.jobhunter.ethiopia.R.string.nav_saved, Icons.Default.Bookmark)
    object Applications : Screen("applications", com.manus.jobhunter.ethiopia.R.string.nav_applications, Icons.Default.Assignment)
    object Profile : Screen("profile", com.manus.jobhunter.ethiopia.R.string.nav_profile, Icons.Default.Person)

    object Onboarding : Screen("onboarding", com.manus.jobhunter.ethiopia.R.string.screen_onboarding)
    object Search : Screen("search", com.manus.jobhunter.ethiopia.R.string.screen_search)
    object JobDetails : Screen("job/{jobId}", com.manus.jobhunter.ethiopia.R.string.screen_job_details)
    object AiMatching : Screen("matching", com.manus.jobhunter.ethiopia.R.string.screen_ai_matching)
    object CvManager : Screen("cv_manager", com.manus.jobhunter.ethiopia.R.string.screen_cv_manager)
    object Notifications : Screen("notifications", com.manus.jobhunter.ethiopia.R.string.screen_notifications)
    object Assistant : Screen("assistant", com.manus.jobhunter.ethiopia.R.string.screen_ai_assistant)
    object Sources : Screen("sources", com.manus.jobhunter.ethiopia.R.string.screen_job_sources)
    object Settings : Screen("settings", com.manus.jobhunter.ethiopia.R.string.screen_settings)

    fun createRoute(vararg args: Any): String {
        var r = route
        args.forEach { r = r.replaceFirst("\\{[^}]+\\}".toRegex(), it.toString()) }
        return r
    }
}

val BOTTOM_TABS = listOf(Screen.Home, Screen.Discover, Screen.Saved, Screen.Applications, Screen.Profile)
