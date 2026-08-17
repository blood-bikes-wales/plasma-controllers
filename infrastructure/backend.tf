terraform {
  backend "gcs" {
    bucket = "plasma-controller-tfstate"
    prefix = "plasma-controller"
  }
}
