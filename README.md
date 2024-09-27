# dodger-ebpf
eBPF powered dodger game!\
You avoid fallen objects by moving starfish.\
player = starfish\
baddie = fish (fallen objects)

> [!IMPORTANT]
> baddie is generated upon packet arrival.\
> packet arrival is measured on XDP using eBPF program.

<img width="1002" alt="image" src="https://github.com/user-attachments/assets/f3868052-725b-46c0-ba30-c72713ad648d">
