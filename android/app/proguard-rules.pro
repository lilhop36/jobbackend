# JobHunter Ethiopia ProGuard rules
-keepattributes Signature, InnerClasses, *Annotation*

# Retrofit + OkHttp
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson
-keep class com.manus.jobhunter.ethiopia.data.remote.** { *; }
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory { *; }
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler { *; }
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Material 3 & Compose
-keep class androidx.compose.material3.** { *; }
