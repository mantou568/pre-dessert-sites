/**
 * Empornium 公告选择器测试脚本
 * 使用：在 Empornium 首页 (https://www.empornium.sx/) 打开，F12 -> Console，粘贴整段运行
 */

function xpath(expr, context, type) {
  type = type || XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
  var doc = context ? context.ownerDocument : document;
  var ctx = context || doc;
  return doc.evaluate(expr, ctx, null, type, null);
}

function xpathOne(expr, context) {
  var r = xpath(expr, context, XPathResult.FIRST_ORDERED_NODE_TYPE);
  return r.singleNodeValue;
}

function xpathString(expr, context) {
  var doc = context ? context.ownerDocument : document;
  var r = doc.evaluate(expr, context || doc, null, XPathResult.STRING_TYPE, null);
  return r.stringValue;
}

var doc = document;
var listExpr = "//div[@class='main_column']/div[starts-with(@id,'news')]";
var list = xpath(listExpr);
var count = list.snapshotLength;

console.log("========== Empornium 公告测试 ==========");
console.log("列表 XPath:", listExpr);
console.log("匹配到的公告数量:", count);
console.log("");

if (count === 0) {
  console.log("【未找到任何公告节点】可能原因：");
  console.log("1. 当前页面不是首页或结构已改");
  console.log("2. main_column 或 id=newsXXX 的 div 不存在");
  console.log("--- 下面做简单结构探测 ---");
  var mainCol = doc.querySelector("div.main_column");
  console.log("是否存在 div.main_column:", !!mainCol);
  var anyNews = doc.querySelector("div[id^='news']");
  console.log("是否存在 div[id^='news']:", !!anyNews);
  if (mainCol) {
    var kids = mainCol.querySelectorAll("div[id^='news']");
    console.log("main_column 下 div[id^='news'] 数量:", kids.length);
  }
  console.log("==========================================");
} else {
  for (var i = 0; i < count; i++) {
    var node = list.snapshotItem(i);
    var idNode = xpathOne("./@id", node);
    var id = idNode ? idNode.value : "";
    var idNum = (id.match(/news(\d+)/) || [])[1] || "";

    var titleNode = xpathOne("./preceding-sibling::div[@class='head'][1]", node);
    var titleRaw = titleNode ? (titleNode.textContent || "").trim() : "";
    var titleMatch = titleRaw.match(/^\s*(.+?)\s+\d+\s+(?:mins?|hours?|days?|weeks?|months?)/);
    var title = titleMatch ? titleMatch[1].trim() : titleRaw;

    var dateNode = xpathOne("./preceding-sibling::div[1]//span[@class='time']/@title", node) || xpathOne("./preceding-sibling::div[1]//span[@class='time']/@alt", node);
    var date = dateNode ? dateNode.value : "";

    var contentNode = xpathOne(".//div[@class='pad']", node);
    var content = contentNode ? (contentNode.textContent || "").trim().slice(0, 120) + "..." : "";

    var link = id ? "/#" + id : "";

    console.log("--- 公告 #" + (i + 1) + " ---");
    console.log("  id (raw):", id, "=> 解析 id:", idNum);
    console.log("  title (raw 前80字):", titleRaw.slice(0, 80));
    console.log("  title (解析后):", title);
    console.log("  date:", date);
    console.log("  content (前120字):", content);
    console.log("  link:", link);
    console.log("");
  }
  console.log("==========================================");
}
