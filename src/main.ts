import "./style.css";

const app: HTMLDivElement = document.querySelector("#app")!;

const appName = "Geocoin Carrier";
document.title = appName;

const header = document.createElement("h1");
header.innerHTML = appName;
app.append(header);

const button = document.createElement("button");
button.addEventListener("click", () => {
  alert("you clicked the button!");
});
app.append(button);
