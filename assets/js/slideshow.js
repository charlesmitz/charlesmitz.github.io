document.addEventListener("DOMContentLoaded", function() {
  const images = document.querySelectorAll(".slideshow-images img");
  let currentImageIndex = 0;

  function showNextImage() {
    images[currentImageIndex].style.display = "none";
    currentImageIndex = (currentImageIndex + 1) % images.length;
    images[currentImageIndex].style.display = "block";
  }

  setInterval(showNextImage, 2000); // Change image every 2 seconds
});


