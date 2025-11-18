package com.cryptominemobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = PackageList(this).packages

        override fun getJSMainModuleName(): String = "mobile/index"

        override fun isNewArchEnabled(): Boolean = DefaultNewArchitectureEntryPoint.fabricEnabled

        override fun isHermesEnabled(): Boolean = true
    }

    override fun onCreate() {
        super.onCreate()
        DefaultNewArchitectureEntryPoint.load()
    }
}
