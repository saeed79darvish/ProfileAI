plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.cue.spike"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.cue.spike"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-spike"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // On-device text recognition: the screenshot never leaves the phone.
    implementation("com.google.mlkit:text-recognition:16.0.1")
}
