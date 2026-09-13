require 'json'

package = JSON.parse(File.read(File.join('..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = "StaticFaceDetection"
  s.version        = package["version"]
  s.summary        = package["description"]
  s.description    = package["description"]
  s.author         = package["author"]
  s.homepage       = "https://github.com/Lambert360/fretiko-mobile"
  s.license        = package["license"]
  s.platforms      = { :ios => "15.5" }
  s.source         = { :git => "https://github.com/Lambert360/fretiko-mobile.git" }
  s.source_files   = "**/*.{h,m,swift}"
  s.dependency     "ExpoModulesCore"
  s.dependency     "GoogleMLKit/FaceDetection"
  s.swift_version  = "5.4"
end
