import com.qualcomm.robotcore.robocol.Command;
import org.firstinspires.ftc.robotcore.internal.network.RobotCoreCommandList;
import javax.imageio.*;
import javax.imageio.stream.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

/** Produces Robocol camera-stream payloads using the real FTC SDK 12.0.0 RobotCore classes. */
public class GenFixtures {
    static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x)); return s.toString(); }
    static String js(String s) { return new com.google.gson.Gson().toJson(s); }

    static String packet(String name, String extra, long ts, int seq) throws Exception {
        Command c = new Command(name, extra);
        Field f = Command.class.getDeclaredField("mTimestamp"); f.setAccessible(true); f.setLong(c, ts);
        c.setSequenceNumber((short) seq);
        return hex(c.toByteArray());
    }

    public static void main(String[] a) throws Exception {
        // Small valid JPEG (~10 KB) so it spans several 4096-byte chunks with a smaller last chunk.
        BufferedImage img = new BufferedImage(240, 180, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        Random r = new Random(39049);
        for (int y = 0; y < 180; y++) for (int x = 0; x < 240; x++) img.setRGB(x, y, (x * 255 / 240) << 16 | (y * 255 / 180) << 8 | r.nextInt(256));
        g.setColor(Color.WHITE); g.setFont(new Font("SansSerif", Font.BOLD, 20)); g.drawString("FTC 12.0", 30, 65); g.dispose();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageWriter w = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam p = w.getDefaultWriteParam(); p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT); p.setCompressionQuality(0.75f);
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(bos)) { w.setOutput(ios); w.write(null, new IIOImage(img, null, null), p); }
        byte[] data = bos.toByteArray();

        int frameNum = 7; long ts = 123456789012345L; int seq = 100;
        StringBuilder o = new StringBuilder("{\n");
        o.append("  \"sdk\": \"FTC SDK 12.0.0 RobotCore (org.firstinspires.ftc:RobotCore:12.0.0), Gson 2.10.1, AOSP android.util.Base64\",\n");
        o.append("  \"chunkSize\": ").append(4096).append(",\n");
        o.append("  \"jpegBase64\": ").append(js(java.util.Base64.getEncoder().encodeToString(data))).append(",\n");
        o.append("  \"jpegWidth\": 240, \"jpegHeight\": 180,\n");

        RobotCoreCommandList.CmdStreamChange sc = new RobotCoreCommandList.CmdStreamChange();
        sc.available = true; String t = sc.serialize();
        sc.available = false; String fa = sc.serialize();
        o.append("  \"streamChangeTrue\": {\"extra\": ").append(js(t)).append(", \"packet\": \"").append(packet("CMD_STREAM_CHANGE", t, ts, seq++)).append("\"},\n");
        o.append("  \"streamChangeFalse\": {\"extra\": ").append(js(fa)).append(", \"packet\": \"").append(packet("CMD_STREAM_CHANGE", fa, ts + 1, seq++)).append("\"},\n");
        o.append("  \"requestFrame\": {\"extra\": ").append(js(new Command("CMD_REQUEST_FRAME").getExtra())).append(", \"packet\": \"").append(packet("CMD_REQUEST_FRAME", new Command("CMD_REQUEST_FRAME").getExtra(), ts + 2, seq++)).append("\"},\n");

        // Same loop as CameraStreamServer.sendFrame() in SDK 12.0.0
        String b = new RobotCoreCommandList.CmdReceiveFrameBegin(frameNum, data.length).serialize();
        o.append("  \"frameNum\": ").append(frameNum).append(", \"length\": ").append(data.length).append(",\n");
        o.append("  \"begin\": {\"extra\": ").append(js(b)).append(", \"packet\": \"").append(packet("CMD_RECEIVE_FRAME_BEGIN", b, ts + 3, seq++)).append("\"},\n");
        o.append("  \"chunks\": [\n");
        int n = (int) Math.ceil(data.length / 4096.0);
        for (int chunkNum = 0; chunkNum < n; chunkNum++) {
            int offset = chunkNum * 4096; int length = Math.min(4096, data.length - offset);
            String c = new RobotCoreCommandList.CmdReceiveFrameChunk(frameNum, chunkNum, data, offset, length).serialize();
            // and the SDK's own decoder round-trip
            RobotCoreCommandList.CmdReceiveFrameChunk d = RobotCoreCommandList.CmdReceiveFrameChunk.deserialize(c);
            if (!Arrays.equals(d.getData(), Arrays.copyOfRange(data, offset, offset + length))) throw new RuntimeException("sdk roundtrip mismatch");
            o.append("    {\"extra\": ").append(js(c)).append(", \"packet\": \"").append(packet("CMD_RECEIVE_FRAME_CHUNK", c, ts + 4 + chunkNum, seq++)).append("\"}").append(chunkNum < n - 1 ? ",\n" : "\n");
        }
        o.append("  ],\n");
        o.append("  \"timestamp\": \"").append(ts).append("\", \"firstSeq\": 100\n}\n");
        System.out.print(o);
    }
}
