const fs = require('fs');
const path = require('path');

const workletsDir = path.join(__dirname, '..', 'node_modules', 'react-native-worklets');
if (fs.existsSync(workletsDir)) {
  const specsDir = path.join(workletsDir, 'src', 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  
  const moduleSpecPath = path.join(specsDir, 'NativeWorkletsModule.ts');
  const indexPath = path.join(specsDir, 'index.ts');

  if (!fs.existsSync(moduleSpecPath)) {
    fs.writeFileSync(moduleSpecPath, `'use strict';

import { type TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  installTurboModule: (bundleModeEnabled: boolean) => boolean;
  prepareBundleMode: () => boolean;
  toggleSlowAnimationsOnUIRuntime: () => boolean;
  start: () => boolean;
}

export default TurboModuleRegistry.get<Spec>('WorkletsModule');
`);
  }

  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `'use strict';

import { RuntimeKind } from '../runtimeKind';
import type { Spec } from './NativeWorkletsModule';

export const WorkletsTurboModule: Spec | null | undefined =
  globalThis.__RUNTIME_KIND === RuntimeKind.ReactNative
    ? (require('./NativeWorkletsModule') as { default: Spec | null }).default
    : null;
`);
  }

  const cmakePath = path.join(workletsDir, 'android', 'CMakeLists.txt');
  if (!fs.existsSync(cmakePath)) {
    fs.writeFileSync(cmakePath, `project(Worklets)
cmake_minimum_required(VERSION 3.16)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(CMAKE_CXX_STANDARD 20)

find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(hermes-engine REQUIRED CONFIG)

include("\${REACT_NATIVE_DIR}/ReactAndroid/cmake-utils/folly-flags.cmake")
add_compile_options(\${folly_FLAGS})

string(APPEND CMAKE_CXX_FLAGS " -DWORKLETS_VERSION=\${WORKLETS_VERSION} -DWORKLETS_FEATURE_FLAGS=\\"\${WORKLETS_FEATURE_FLAGS}\\"")
set(HERMES_V1_ENABLED "\${HERMES_V1_ENABLED}")
string(APPEND CMAKE_CXX_FLAGS " -fno-omit-frame-pointer -fstack-protector-all")

if(NOT \${CMAKE_BUILD_TYPE} MATCHES "Debug")
  string(APPEND CMAKE_CXX_FLAGS " -DNDEBUG")
endif()

set(BUILD_DIR "\${CMAKE_SOURCE_DIR}/build")
set(ANDROID_CPP_DIR "\${CMAKE_SOURCE_DIR}/src/main/cpp")
set(COMMON_CPP_DIR "\${CMAKE_SOURCE_DIR}/../Common/cpp")

file(GLOB_RECURSE WORKLETS_COMMON_CPP_SOURCES CONFIGURE_DEPENDS "\${COMMON_CPP_DIR}/worklets/*.cpp")
file(GLOB_RECURSE WORKLETS_ANDROID_CPP_SOURCES CONFIGURE_DEPENDS "\${ANDROID_CPP_DIR}/worklets/*.cpp")

add_library(worklets SHARED \${WORKLETS_COMMON_CPP_SOURCES} \${WORKLETS_ANDROID_CPP_SOURCES})
target_precompile_headers(worklets PRIVATE "\${ANDROID_CPP_DIR}/WorkletsPCH.h")
target_compile_options(worklets PRIVATE "$<$<COMPILE_LANGUAGE:CXX>:-Xclang;-fno-pch-timestamp>")

include("\${REACT_NATIVE_DIR}/ReactCommon/cmake-utils/react-native-flags.cmake")
target_compile_reactnative_options(worklets PUBLIC)

target_include_directories(worklets PUBLIC "\${COMMON_CPP_DIR}" "\${ANDROID_CPP_DIR}")
target_include_directories(worklets PRIVATE
  "\${REACT_NATIVE_DIR}/ReactCommon"
  "\${REACT_NATIVE_DIR}/ReactCommon/yoga"
  "\${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule"
  "\${REACT_NATIVE_DIR}/ReactCommon/react/nativemodule/core/ReactCommon"
  "\${REACT_NATIVE_DIR}/ReactCommon/callinvoker"
  "\${REACT_NATIVE_DIR}/ReactCommon/runtimeexecutor"
  "\${REACT_NATIVE_DIR}/ReactCommon/jsiexecutor"
  "\${REACT_NATIVE_DIR}/ReactCommon/react/renderer/graphics/platform/cxx"
)

set_target_properties(worklets PROPERTIES LINKER_LANGUAGE CXX)
target_link_libraries(worklets android log ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni hermes-engine::hermesvm)
`);
  }
}

  // Fix react-native field in package.json (pointing to non-existent ./src/index instead of ./lib/module/index)
  const pkgJsonPath = path.join(workletsDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (pkg['react-native'] === './src/index') {
      pkg['react-native'] = './lib/module/index';
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
    }
  }
