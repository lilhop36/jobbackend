package com.manus.jobhunter.ethiopia

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.manus.jobhunter.ethiopia.presentation.navigation.*
import com.manus.jobhunter.ethiopia.presentation.screens.*
import com.manus.jobhunter.ethiopia.presentation.theme.JobHunterTheme
import com.manus.jobhunter.ethiopia.worker.NotificationWorker
import com.manus.jobhunter.ethiopia.worker.SyncWorker
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.Locale

class MainActivity : ComponentActivity() {

    override fun attachBaseContext(base: Context) {
        val app = (base.applicationContext as? JobHunterApp)
        val lang = runCatching { runBlocking { app?.container?.prefs?.language?.first() } }.getOrNull() ?: "en"
        val locale = Locale(lang)
        val conf = base.resources.configuration
        conf.setLocale(locale)
        super.attachBaseContext(base.createConfigurationContext(conf))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as JobHunterApp).container
        SyncWorker.enqueue(this)

        setContent {
            JobHunterTheme {
                AppNav(container)
            }
        }
    }
}

@Composable
fun AppNav(container: AppContainer) {
    val nav = rememberNavController()
    val homeVm = remember { HomeViewModel(container) }
    val discoverVm = remember { DiscoverViewModel(container) }
    val searchVm = remember { SearchViewModel(container) }
    val matchingVm = remember { MatchingViewModel(container) }
    val cvVm = remember { CvViewModel(container) }
    val savedVm = remember { SavedViewModel(container) }
    val appsVm = remember { ApplicationsViewModel(container) }
    val sourcesVm = remember { SourcesViewModel(container) }
    val assistantVm = remember { AssistantViewModel(container) }
    val settingsVm = remember { SettingsViewModel(container) }

    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val isTab = BOTTOM_TABS.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (isTab) {
                NavigationBar {
                    BOTTOM_TABS.forEach { s ->
                        NavigationBarItem(
                            selected = currentRoute == s.route,
                            onClick = {
                                nav.navigate(s.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { s.icon?.let { Icon(it, contentDescription = stringResource(s.titleRes)) } },
                            label = { Text(stringResource(s.titleRes)) }
                        )
                    }
                }
            }
        }
    ) { pad ->
        NavHost(nav, startDestination = Screen.Home.route, modifier = Modifier.padding(pad).fillMaxSize()) {
            composable(Screen.Home.route) {
                HomeScreen(
                    homeVm,
                    onOpenJob = { nav.navigate(Screen.JobDetails.createRoute(it)) },
                    onSearch = { nav.navigate(Screen.Search.route) },
                    onSources = { nav.navigate(Screen.Sources.route) },
                    onAssistant = { nav.navigate(Screen.Assistant.route) }
                )
            }
            composable(Screen.Discover.route) { DiscoverScreen(discoverVm, onOpenJob = { nav.navigate(Screen.JobDetails.createRoute(it)) }) }
            composable(Screen.Saved.route) { SavedScreen(savedVm, onOpenJob = { nav.navigate(Screen.JobDetails.createRoute(it)) }) }
            composable(Screen.Applications.route) { ApplicationsScreen(appsVm) }
            composable(Screen.Profile.route) { SettingsScreen(settingsVm, onSources = { nav.navigate(Screen.Sources.route) }) }

            composable(Screen.Search.route) { SearchScreen(searchVm, onOpenJob = { nav.navigate(Screen.JobDetails.createRoute(it)) }) }
            composable(Screen.JobDetails.route) { back ->
                val id = back.arguments?.getString("jobId") ?: return@composable
                val detailVm = remember(id) { JobDetailViewModel(container, id) }
                JobDetailScreen(detailVm)
            }
            composable(Screen.AiMatching.route) { AiMatchingScreen(matchingVm) }
            composable(Screen.CvManager.route) { CvManagerScreen(cvVm) }
            composable(Screen.Notifications.route) { NotificationsScreen() }
            composable(Screen.Assistant.route) { AssistantScreen(assistantVm) }
            composable(Screen.Sources.route) { SourcesScreen(sourcesVm) }
            composable(Screen.Settings.route) { SettingsScreen(settingsVm, onSources = { nav.navigate(Screen.Sources.route) }) }
            composable(Screen.Onboarding.route) { OnboardingScreen(onDone = { nav.popBackStack() }) }
        }
    }
}
