try {
  if (localStorage.getItem("theme") !== "light")
    document.documentElement.classList.add("dark");
} catch (e) {
  document.documentElement.classList.add("dark"); // dark is the default
}
