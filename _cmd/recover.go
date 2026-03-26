package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {

	fmt.Println("start main")
	defer none()
	flag.Parse()
	args := flag.Args()
	arg := ""
	if len(args) > 0 {
		arg = args[0]
	}

	err := run(arg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("end main")
}

func run(arg string) error {

	fmt.Println("run() start")

	if arg == "1" {
		return fmt.Errorf("arg mean error")
	} else if arg == "2" {
		panic("arg mean panic")
	}

	fmt.Println("run() end")
	return nil
}

func none() {
	fmt.Println("none() start")
	if err := recover(); err != nil {
		fmt.Printf("Recover: %v\n", err)
	}
	fmt.Println("none() end")
}
