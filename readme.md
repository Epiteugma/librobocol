# librobocol

A TypeScript implementation of the *FIRST* Tech Challenge "robocol" protocol, used for communication between the Driver Station and Robot Contoller.

This implementation is independent of the JavaScript runtime and can be embedded not only into NodeJS/Bun projects, but also the browser.

## Camera stream

`commands/cameraStream.ts` implements the extras of the four camera stream commands (`CMD_STREAM_CHANGE`,
`CMD_REQUEST_FRAME`, `CMD_RECEIVE_FRAME_BEGIN`, `CMD_RECEIVE_FRAME_CHUNK`) of FTC SDK 12.0, plus a
`FrameAssembler` that rebuilds one JPEG frame from its chunks.

## Tests

```sh
bun test
```

`tests/fixtures/sdk12-camera-stream.json` contains datagrams produced by the real FTC SDK 12.0.0 classes; see
`tests/fixtures/README.md`.
