Pod::Spec.new do |s|
  s.name           = 'AfribitNetwork'
  s.version        = '0.1.0'
  s.summary        = 'Afribit mesh network probes'
  s.description    = 'Wi-Fi bound mesh beacon probes for the Afribit shell (Android today; iOS falls back to fetch).'
  s.author         = 'Afribit Africa'
  s.homepage       = 'https://afribit.africa'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
