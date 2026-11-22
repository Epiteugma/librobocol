# SDK 12.0 camera stream fixtures

`sdk12-camera-stream.json` was produced by `GenFixtures.java`, which calls the real FTC SDK 12.0.0 classes
(`org.firstinspires.ftc:RobotCore:12.0.0` from Maven Central):

- `RobotCoreCommandList.CmdStreamChange`, `CmdReceiveFrameBegin` and `CmdReceiveFrameChunk` `serialize()`
  for the command extras,
- `com.qualcomm.robotcore.robocol.Command#toByteArray()` for the complete datagrams (`packet`, hex),
- the chunking loop of `CameraStreamServer.sendFrame()` (4096-byte chunks, `chunkNum * 4096` offsets).

The JPEG is a 240×180 test image (3 chunks, last one smaller). `CmdReceiveFrameChunk` uses
`android.util.Base64`, which is not in RobotCore; the AOSP source of that class was compiled next to it. Gson is
2.10.1 with default settings, like `SimpleGson`.

To regenerate (JDK 11+):

```sh
curl -LO https://repo1.maven.org/maven2/org/firstinspires/ftc/RobotCore/12.0.0/RobotCore-12.0.0.aar
unzip -p RobotCore-12.0.0.aar classes.jar > RobotCore.jar
curl -LO https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar
mkdir -p android/util && curl -L https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/java/android/util/Base64.java -o android/util/Base64.java
sed -i '/UnsupportedAppUsage;/d; /@android.ravenwood/d; s/@UnsupportedAppUsage//g' android/util/Base64.java
javac -cp RobotCore.jar:gson-2.10.1.jar -d out android/util/Base64.java GenFixtures.java
java -Djava.awt.headless=true -cp out:RobotCore.jar:gson-2.10.1.jar GenFixtures > sdk12-camera-stream.json
```
