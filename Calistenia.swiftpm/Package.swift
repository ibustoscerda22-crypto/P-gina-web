// swift-tools-version: 5.8

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Calistenia",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "Calistenia",
            targets: ["AppModule"],
            bundleIdentifier: "cl.calistenia.inicio",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .running),
            accentColor: .presetColor(.orange),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
