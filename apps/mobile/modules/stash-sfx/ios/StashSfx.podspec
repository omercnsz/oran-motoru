Pod::Spec.new do |s|
  s.name           = 'StashSfx'
  s.version        = '1.0.0'
  s.summary        = 'Low-latency sound effects for StashOdds'
  s.description    = 'Preloaded AVAudioPlayer pools played on a background queue'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
