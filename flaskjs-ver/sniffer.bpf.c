#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>

struct packet_info_t {
    u32 src_ip;
    u32 dest_ip;
    u16 packet_len;
    u8 type; // icmp/tcp/udp
};

BPF_PERF_OUTPUT(events);

int packet_monitor(struct xdp_md *ctx) {
	void *data_end = (void *)(long)ctx->data_end;
	void *data = (void *)(long)ctx->data;
	struct ethhdr *eth = data;
	if ((void *)eth + sizeof(struct ethhdr) > data_end)
		return XDP_PASS;
	struct iphdr *ip = (void *)eth + sizeof(struct ethhdr);
	if ((void *)ip + sizeof(struct iphdr) > data_end)
		return XDP_PASS;

/*
    struct ethhdr *eth = (struct ethhdr *)(long)ctx->data;
	if (eth + sizeof(struct ethhdr) > (long)ctx->data_end)
		return XDP_PASS;
    struct iphdr *ip = (struct iphdr *)(eth + 1);
*/

	//bpf_trace_printk("packet arrived");
//	if (ip->protocol != 0x01)
//		return XDP_PASS;

	bpf_trace_printk("icmp hello");
    //if (eth->h_proto != __constant_htons(ETH_P_IP))
    //    return XDP_PASS;

    struct packet_info_t pkt = {};
    //pkt.src_ip = ntohl(ip->saddr);
    //pkt.dest_ip = ntohl(ip->daddr);
    pkt.src_ip = ip->saddr;
    pkt.dest_ip = ip->daddr;
    pkt.packet_len = (u16)(ctx->data_end - ctx->data);
    pkt.type = ip->protocol;

    events.perf_submit(ctx, &pkt, sizeof(pkt));
    return XDP_PASS;
}

